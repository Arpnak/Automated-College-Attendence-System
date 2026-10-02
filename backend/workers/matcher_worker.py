"""Matcher Worker — FastAPI server + Kafka consumer (attendx.face-crop.v1)

Resilient against Kafka connection failures: consumer thread reconnects with backoff.

Run: uvicorn matcher_worker:app --host 0.0.0.0 --port 8001
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import io
import json
import time
import threading
import warnings

warnings.filterwarnings('ignore', category=DeprecationWarning, module='kafka')

import requests
import cloudinary
import cloudinary.utils
import psycopg2
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form
from kafka import KafkaConsumer, KafkaProducer
from redis import Redis
import config
from face.matcher import index_face, search_face

# ── Cloudinary ────────────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name=config.CLOUDINARY_CLOUD_NAME,
    api_key=config.CLOUDINARY_API_KEY,
    api_secret=config.CLOUDINARY_API_SECRET,
    secure=True,
)

# ── Redis ─────────────────────────────────────────────────────────────────────
_redis = Redis.from_url(config.REDIS_URL, decode_responses=True)


def _get_db():
    return psycopg2.connect(config.DATABASE_URL)


def make_consumer():
    return KafkaConsumer(
        'attendx.face-crop.v1',
        bootstrap_servers=config.KAFKA_BROKERS,
        group_id='attendx-matcher-group',
        auto_offset_reset='latest',
        enable_auto_commit=True,
        consumer_timeout_ms=5000,
    )


def make_producer():
    return KafkaProducer(bootstrap_servers=config.KAFKA_BROKERS)


# ── FastAPI lifespan ──────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    t = threading.Thread(target=kafka_consumer_thread, daemon=True)
    t.start()
    yield


app = FastAPI(title='AttendX Face Worker', lifespan=lifespan)


# ── /index endpoint ───────────────────────────────────────────────────────────
@app.post('/index')
async def index_face_endpoint(
    student_id: str = Form(...),
    photo: UploadFile = File(...),
):
    image_bytes = await photo.read()
    result = index_face(image_bytes, student_id, collection_id='')
    return result


# ── Rate limiter (C5) ─────────────────────────────────────────────────────────
def acquire_token() -> bool:
    key = 'rekognition:ratelimit:tokens'
    tokens = _redis.get(key)
    if tokens is None:
        _redis.set(key, config.RATE_PER_SEC - 1, ex=1)
        return True
    if int(tokens) > 0:
        _redis.decr(key)
        return True
    return False


def wait_for_token():
    while not acquire_token():
        time.sleep(0.1)


def download_crop(public_id: str) -> bytes:
    url = cloudinary.utils.cloudinary_url(public_id)[0]
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def get_enrolled_students(course_id: str) -> list:
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT student_id FROM course_enrollments WHERE course_id = %s AND status = 'approved'",
                (course_id,)
            )
            return [str(row[0]) for row in cur.fetchall()]
    finally:
        conn.close()


def store_unidentified(session_id, crop_id, best_guess_id, confidence) -> str:
    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO unidentified_faces
                     (session_id, crop_cloudinary_id, best_guess_student_id, confidence)
                   VALUES (%s, %s, %s, %s) RETURNING id""",
                (session_id, crop_id, best_guess_id, confidence)
            )
            face_id = str(cur.fetchone()[0])
        conn.commit()
        return face_id
    finally:
        conn.close()


def decrement_and_check(session_id: str, producer: KafkaProducer):
    remaining = _redis.decr(f'session:{session_id}:total_faces')
    meta = _redis.hgetall(f'session:{session_id}:meta')
    if remaining <= 0 and meta.get('all_images_processed') == 'true':
        conn = _get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM attendance_logs WHERE session_id = %s AND status = 'present'",
                    (session_id,)
                )
                total_matched = cur.fetchone()[0]
        finally:
            conn.close()
        _redis.publish(
            f'session:{session_id}:events',
            json.dumps({'type': 'PROCESSING_COMPLETE', 'payload': {
                'sessionId': session_id,
                'totalDetected': max(0, int(remaining or 0)),
                'totalMatched': int(total_matched),
            }})
        )
        print(f'[Matcher] PROCESSING_COMPLETE for session {session_id}')


def process_crop(payload: dict, producer: KafkaProducer):
    session_id = payload['sessionId']
    course_id = payload['courseId']
    crop_id = payload['cropCloudinaryId']
    face_index = payload['faceIndex']

    if payload.get('forceNeedsReview'):
        face_id = store_unidentified(session_id, crop_id, None, 0.0)
        _redis.publish(f'session:{session_id}:events', json.dumps({
            'type': 'FACE_NEEDS_REVIEW',
            'payload': {'faceId': face_id, 'cropUrl': cloudinary.utils.cloudinary_url(crop_id)[0],
                        'confidence': 0.0, 'pictureIndex': face_index, 'bestGuessStudentId': None}
        }))
        decrement_and_check(session_id, producer)
        return

    try:
        image_bytes = download_crop(crop_id)
    except Exception as exc:
        print(f'[Matcher] Failed to download crop {crop_id}: {exc}')
        decrement_and_check(session_id, producer)
        return

    wait_for_token()

    enrolled_ids = get_enrolled_students(course_id) if not config.USE_AWS else []
    collection_id = f'{config.AWS_REKOGNITION_COLLECTION_PREFIX}{course_id}'

    try:
        result = search_face(image_bytes, collection_id, enrolled_ids)
    except Exception as exc:
        err_str = str(exc)
        if 'ProvisionedThroughputExceededException' in err_str or 'Throttling' in err_str:
            attempt = payload.get('attempt', 0) + 1
            dlq_msg = json.dumps({**payload, 'attempt': attempt,
                                   'nextRetryAt': time.time() + min(2 ** attempt, 32)}).encode('utf-8')
            producer.send('attendx.face-match-dlq.v1', dlq_msg)
            print(f'[Matcher] Throttled → DLQ attempt={attempt} for {crop_id}')
            return
        print(f'[Matcher] Search error for {crop_id}: {exc}')
        decrement_and_check(session_id, producer)
        return

    student_id = result.get('student_id')
    confidence = result.get('confidence', 0.0)
    matched = result.get('matched', False)

    if matched and student_id:
        if _redis.setnx(f'session:{session_id}:student:{student_id}', 'present'):
            _redis.rpush(f'session:{session_id}:matched_buffer', json.dumps({
                'studentId': student_id, 'confidence': confidence, 'pictureIndex': face_index,
            }))
            _redis.publish(f'session:{session_id}:events', json.dumps({
                'type': 'FACE_MATCHED',
                'payload': {'studentId': student_id, 'status': 'present',
                            'confidence': confidence, 'pictureIndex': face_index}
            }))
    else:
        best_guess_id = student_id if not matched else None
        face_id = store_unidentified(session_id, crop_id, best_guess_id, confidence)
        _redis.rpush(f'session:{session_id}:unidentified', crop_id)
        _redis.publish(f'session:{session_id}:events', json.dumps({
            'type': 'FACE_NEEDS_REVIEW',
            'payload': {'faceId': face_id, 'cropUrl': cloudinary.utils.cloudinary_url(crop_id)[0],
                        'confidence': confidence, 'pictureIndex': face_index,
                        'bestGuessStudentId': best_guess_id}
        }))

    decrement_and_check(session_id, producer)
    producer.flush()


# ── Resilient Kafka consumer thread ──────────────────────────────────────────
def kafka_consumer_thread():
    brokers = ', '.join(config.KAFKA_BROKERS)
    print(f'[Matcher] Kafka thread starting — brokers: {brokers}')
    attempt = 0

    while True:
        consumer = None
        producer = None
        try:
            print(f'[Matcher] Connecting to Kafka... (attempt {attempt + 1})')
            consumer = make_consumer()
            producer = make_producer()
            print('[Matcher] Connected ✓  Listening on attendx.face-crop.v1')
            attempt = 0

            for msg in consumer:
                if msg is None:
                    continue
                try:
                    payload = json.loads(msg.value.decode('utf-8'))
                    process_crop(payload, producer)
                except Exception as exc:
                    print(f'[Matcher] Message error: {exc}')

        except Exception as exc:
            attempt += 1
            backoff = min(5 * attempt, 60)
            print(f'[Matcher] Kafka error: {exc}')
            print(f'[Matcher] Reconnecting in {backoff}s...')
            time.sleep(backoff)
        finally:
            if producer:
                try: producer.close(timeout=2)
                except: pass
            if consumer:
                try: consumer.close()
                except: pass
