"""Cropper Worker — Kafka consumer for attendx.raw-image.v1

Resilient against Kafka connection failures: retries with backoff instead of crashing.

Run: python cropper_worker.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import io
import json
import time
import uuid as _uuid
import warnings

# Suppress kafka-python 3.x serialiser deprecation warnings (lambdas still work fine)
warnings.filterwarnings('ignore', category=DeprecationWarning, module='kafka')

import requests
import cv2
import numpy as np
import cloudinary
import cloudinary.uploader
from kafka import KafkaConsumer, KafkaProducer
from redis import Redis
import config

# ── Cloudinary ────────────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name=config.CLOUDINARY_CLOUD_NAME,
    api_key=config.CLOUDINARY_API_KEY,
    api_secret=config.CLOUDINARY_API_SECRET,
    secure=True,
)

# ── Redis ─────────────────────────────────────────────────────────────────────
_redis = Redis.from_url(config.REDIS_URL, decode_responses=True)

# ── Haar cascade face detector ────────────────────────────────────────────────
_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)


# ── Kafka factory with explicit connect test ──────────────────────────────────
def make_consumer():
    return KafkaConsumer(
        'attendx.raw-image.v1',
        bootstrap_servers=config.KAFKA_BROKERS,
        group_id='attendx-cropper-group',
        auto_offset_reset='latest',
        enable_auto_commit=True,
        consumer_timeout_ms=5000,   # poll for 5 s then return (so we can retry)
    )


def make_producer():
    return KafkaProducer(
        bootstrap_servers=config.KAFKA_BROKERS,
    )


# ── Image helpers ─────────────────────────────────────────────────────────────
def download_cloudinary_image(public_id: str) -> bytes:
    url = cloudinary.CloudinaryImage(public_id).build_url()
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def detect_and_crop_faces(image_bytes: bytes) -> list:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    crops = []
    h_img, w_img = img.shape[:2]
    if len(faces) == 0:
        return crops
    for (x, y, w, h) in faces:
        pad = int(0.25 * min(w, h))
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(w_img, x + w + pad), min(h_img, y + h + pad)
        crop = img[y1:y2, x1:x2]
        _, buf = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
        crops.append(buf.tobytes())
    return crops


def upload_crop(crop_bytes: bytes, session_id: str, face_idx: int) -> str:
    public_id = f'crops/{session_id}/{face_idx}_{_uuid.uuid4().hex[:8]}'
    result = cloudinary.uploader.upload(
        io.BytesIO(crop_bytes), public_id=public_id, resource_type='image',
    )
    return result['public_id']


def process_raw_image(payload: dict, producer: KafkaProducer):
    session_id = payload['sessionId']
    course_id = payload['courseId']
    public_id = payload['cloudinaryPublicId']
    picture_index = payload['pictureIndex']
    print(f'[Cropper] Processing image {picture_index} for session {session_id}')

    try:
        image_bytes = download_cloudinary_image(public_id)
        crops = detect_and_crop_faces(image_bytes)
        face_count = len(crops)
        print(f'[Cropper] Detected {face_count} faces in image {picture_index}')

        # Also increment total_faces for historical UI stats
        if face_count > 0:
            _redis.incrby(f'session:{session_id}:total_faces', face_count)

        for i, crop_bytes in enumerate(crops):
            crop_key = upload_crop(crop_bytes, session_id, i)
            # Increment the critical counter used by Node.js BEFORE pushing to Kafka
            _redis.incrby(f'session:{session_id}:pending_crops', 1)
            msg = json.dumps({
                'sessionId': session_id,
                'courseId': course_id,
                'cropCloudinaryId': crop_key,
                'faceIndex': i,
                'pictureIndex': picture_index
            }).encode('utf-8')
            producer.send('attendx.face-crop.v1', msg)

        if picture_index >= 3:
            _redis.hset(f'session:{session_id}:meta', 'all_images_processed', 'true')
            print(f'[Cropper] All images processed flag set for session {session_id}')

        producer.flush()

    except Exception as exc:
        print(f'[Cropper] ERROR processing {session_id}/{picture_index}: {exc}')
        # If the last picture fails entirely, we must still unblock the session
        if picture_index >= 3:
            _redis.hset(f'session:{session_id}:meta', 'all_images_processed', 'true')


# ── Resilient main loop (reconnects on Kafka failure) ─────────────────────────
def main():
    brokers = ', '.join(config.KAFKA_BROKERS)
    print(f'[Cropper] Starting — Kafka brokers: {brokers}')
    attempt = 0

    while True:
        consumer = None
        producer = None
        try:
            print(f'[Cropper] Connecting to Kafka... (attempt {attempt + 1})')
            consumer = make_consumer()
            producer = make_producer()
            print('[Cropper] Connected ✓  Listening on attendx.raw-image.v1')
            attempt = 0  # reset backoff on successful connect

            for msg in consumer:
                if msg is None:
                    continue
                try:
                    payload = json.loads(msg.value.decode('utf-8'))
                    process_raw_image(payload, producer)
                except Exception as exc:
                    print(f'[Cropper] Message error: {exc}')

        except KeyboardInterrupt:
            print('[Cropper] Shutting down...')
            break
        except Exception as exc:
            attempt += 1
            backoff = min(5 * attempt, 60)
            print(f'[Cropper] Kafka error: {exc}')
            print(f'[Cropper] Reconnecting in {backoff}s...')
            time.sleep(backoff)
        finally:
            if producer:
                try: producer.close(timeout=2)
                except: pass
            if consumer:
                try: consumer.close()
                except: pass


if __name__ == '__main__':
    main()
