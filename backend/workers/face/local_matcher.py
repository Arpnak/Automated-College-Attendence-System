"""Local face matching using DeepFace + PostgreSQL embeddings storage.
Used when AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are absent.

Flow:
  index_face  → extract embedding → store in face_embeddings table
  search_face → extract embedding → cosine-compare with enrolled students
"""
import json
import numpy as np
import cv2
import psycopg2
import config

_MODEL = 'VGG-Face'

# ── Database helper ───────────────────────────────────────────────────────────

def _get_db():
    return psycopg2.connect(config.DATABASE_URL)


# ── Embedding helpers ─────────────────────────────────────────────────────────

def _decode_image(image_bytes: bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _extract_embedding(img) -> list | None:
    """Return face embedding list or None if no face detected."""
    try:
        from deepface import DeepFace
        result = DeepFace.represent(img, model_name=_MODEL, enforce_detection=True)
        return result[0]['embedding'] if result else None
    except Exception:
        return None


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


# ── Public API (same interface as rekognition.py) ─────────────────────────────

def index_face(image_bytes: bytes, student_id: str, _collection_id: str = '') -> dict:
    """Extract embedding from photo and store in face_embeddings table."""
    img = _decode_image(image_bytes)
    embedding = _extract_embedding(img)
    if embedding is None:
        return {'face_indexed': False}

    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO face_embeddings (student_id, embedding, model)
                   VALUES (%s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (student_id, json.dumps(embedding), _MODEL)
            )
        conn.commit()
    finally:
        conn.close()

    return {'face_indexed': True}


def search_face(image_bytes: bytes, collection_id: str, enrolled_student_ids: list = None) -> dict:
    """Compare crop against stored embeddings for enrolled students.
    
    collection_id is ignored in local mode (collection = enrolled_student_ids).
    enrolled_student_ids: list of UUIDs to compare against.
    """
    img = _decode_image(image_bytes)
    crop_embedding = _extract_embedding(img)
    if crop_embedding is None:
        return {'matched': False, 'student_id': None, 'confidence': 0.0, 'candidates': []}

    if not enrolled_student_ids:
        return {'matched': False, 'student_id': None, 'confidence': 0.0, 'candidates': []}

    crop_vec = np.array(crop_embedding)

    conn = _get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT student_id, embedding FROM face_embeddings
                   WHERE student_id = ANY(%s)""",
                (enrolled_student_ids,)
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return {'matched': False, 'student_id': None, 'confidence': 0.0, 'candidates': []}

    candidates = []
    for (sid, emb_json) in rows:
        stored_vec = np.array(json.loads(emb_json))
        sim = _cosine_similarity(crop_vec, stored_vec)
        # Convert similarity (0–1) to percentage confidence (0–100)
        confidence = round(sim * 100, 2)
        candidates.append({'student_id': str(sid), 'confidence': confidence})

    candidates.sort(key=lambda x: x['confidence'], reverse=True)
    best = candidates[0] if candidates else {'student_id': None, 'confidence': 0.0}

    return {
        'matched': best['confidence'] >= config.CONFIDENCE_THRESHOLD,
        'student_id': best['student_id'],
        'confidence': best['confidence'],
        'candidates': candidates[:5],
    }
