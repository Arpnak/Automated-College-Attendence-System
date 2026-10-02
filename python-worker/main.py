"""
ClassRoll Python Face Worker
==========================
FastAPI microservice that:
1. POST /index   — indexes a student's reference face photo
2. POST /detect  — [NEW] finds every face in a raw classroom photo, crops and
                    uploads each one to Cloudinary, returns crop refs.
                    This is the missing "cropper" stage — attendx.raw-image.v1
                    had no consumer before this; nothing else in the codebase
                    turned a full-class photo into individual face crops.
3. POST /match   — matches a single cropped face against a course's enrolled students

Dependencies: see requirements.txt
Env vars: DB_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
          CLOUDINARY_API_SECRET, FACE_WORKER_THRESHOLD (default 0.40)
"""

import os
import io
import json
import logging
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

import requests
import numpy as np
from PIL import Image
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
from deepface import DeepFace

# ── Config ────────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("face-worker")

DB_URL        = os.getenv("DATABASE_URL", "")
THRESHOLD     = float(os.getenv("FACE_WORKER_THRESHOLD", "0.40"))
MODEL_NAME    = os.getenv("DEEPFACE_MODEL", "Facenet512")
DETECTOR      = os.getenv("DEEPFACE_DETECTOR", "retinaface")

# Faces smaller than this fraction of image width are almost always background
# noise (posters, phone screens in the shot, etc.) rather than real students.
MIN_FACE_WIDTH_FRACTION = float(os.getenv("MIN_FACE_WIDTH_FRACTION", "0.03"))
MIN_DETECTION_CONFIDENCE = float(os.getenv("MIN_DETECTION_CONFIDENCE", "0.85"))
CROP_PADDING_FRACTION   = float(os.getenv("CROP_PADDING_FRACTION", "0.15"))

cloudinary.config(
    cloud_name  = os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key     = os.getenv("CLOUDINARY_API_KEY"),
    api_secret  = os.getenv("CLOUDINARY_API_SECRET"),
    secure      = True,
)

app = FastAPI(title="ClassRoll Face Worker", version="1.2.0")

def get_db():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def _load_embeddings_for_course(course_id: str) -> dict:
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT fe.student_id, fe.embedding
                FROM face_embeddings fe
                JOIN course_enrollments ce ON ce.student_id = fe.student_id
                WHERE ce.course_id = %s AND ce.status = 'approved'
            """, (course_id,))
            rows = cur.fetchall()
    finally:
        conn.close()

    student_vecs = {}
    for row in rows:
        sid = str(row["student_id"])
        emb = np.array(row["embedding"], dtype=np.float32)
        student_vecs.setdefault(sid, []).append(emb)

    return {sid: np.mean(vecs, axis=0) for sid, vecs in student_vecs.items()}

def _save_embedding(student_id: str, embedding: list, photo_index: int):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO face_embeddings (student_id, embedding, model)
                   VALUES (%s, %s, %s)""",
                (student_id, json.dumps(embedding), MODEL_NAME),
            )
        conn.commit()
    finally:
        conn.close()

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0

def _download_cloudinary_image(public_id: str) -> Image.Image:
    url = cloudinary.utils.cloudinary_url(public_id)[0]
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to fetch '{public_id}' from Cloudinary")
    return Image.open(io.BytesIO(resp.content)).convert("RGB")

@app.post("/index")
async def index_face(
    student_id: str = Form(...),
    photo_index: int = Form(1),
    photo: UploadFile = File(...),
):
    image_bytes = await photo.read()
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(pil_img)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid image: {e}")

    try:
        result = DeepFace.represent(
            img_path=img_array,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            enforce_detection=True,
        )
    except ValueError:
        raise HTTPException(status_code=422, detail="No face detected in photo.")

    if not result:
        raise HTTPException(status_code=422, detail="No face detected.")

    embedding = result[0]["embedding"]
    _save_embedding(student_id, embedding, photo_index)
    log.info(f"Indexed face for student {student_id}")
    return JSONResponse({"face_indexed": True, "photo_index": photo_index})


class DetectRequest(BaseModel):
    sessionId: str
    courseId: str
    cloudinaryPublicId: str
    pictureIndex: int = 1


@app.post("/detect")
async def detect_faces(req: DetectRequest):
    """
    Finds every face in a raw classroom photo, crops and uploads each one
    to Cloudinary under crops/{sessionId}/..., and returns crop refs.

    This is the piece that was missing entirely: nothing previously turned
    attendx.raw-image.v1 (the whole-class photo) into the individual face
    crops that attendx.face-crop.v1 / attendanceConsumer.js expect.
    """
    pil_img = _download_cloudinary_image(req.cloudinaryPublicId)
    img_array = np.array(pil_img)

    try:
        faces = DeepFace.extract_faces(
            img_path=img_array,
            detector_backend=DETECTOR,
            enforce_detection=False,
            align=False,
        )
    except Exception as e:
        log.error(f"Face detection error on {req.cloudinaryPublicId}: {e}")
        return {"totalDetected": 0, "faces": []}

    min_face_width = pil_img.width * MIN_FACE_WIDTH_FRACTION
    results = []

    for f in faces:
        confidence = float(f.get("confidence", 0) or 0)
        area = f.get("facial_area") or {}
        w, h = area.get("w", 0), area.get("h", 0)

        # enforce_detection=False makes DeepFace return one zero-area/zero-confidence
        # placeholder when nothing is found — skip it instead of "detecting" a face
        # that covers the whole image at 0% confidence. Filter low-confidence false positives.
        if confidence < MIN_DETECTION_CONFIDENCE or w < min_face_width:
            continue

        x, y = area.get("x", 0), area.get("y", 0)
        pad_x, pad_y = int(w * CROP_PADDING_FRACTION), int(h * CROP_PADDING_FRACTION)
        left   = max(0, x - pad_x)
        top    = max(0, y - pad_y)
        right  = min(pil_img.width,  x + w + pad_x)
        bottom = min(pil_img.height, y + h + pad_y)

        crop = pil_img.crop((left, top, right, bottom))
        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=90)
        buf.seek(0)

        public_id = f"{uuid4().hex}"
        upload = cloudinary.uploader.upload(
            buf,
            folder=f"crops/{req.sessionId}",
            public_id=public_id,
            overwrite=True,
        )

        results.append({
            "cropCloudinaryId": upload["public_id"],
            "confidence": round(confidence * 100, 2),
        })

    log.info(
        f"[/detect] session={req.sessionId} picture={req.pictureIndex} "
        f"raw_faces={len(faces)} kept={len(results)}"
    )
    return {"totalDetected": len(results), "faces": results}


class MatchRequest(BaseModel):
    courseId: str
    cropCloudinaryId: str

@app.post("/match")
async def match_face(req: MatchRequest):
    enrolled = _load_embeddings_for_course(req.courseId)
    if not enrolled:
        return {"match": False, "studentId": None, "confidence": 0}

    pil_img = _download_cloudinary_image(req.cropCloudinaryId)
    img_array = np.array(pil_img)

    try:
        emb_result = DeepFace.represent(
            img_path=img_array,
            model_name=MODEL_NAME,
            detector_backend="skip",
            enforce_detection=False,
        )
        face_emb = np.array(emb_result[0]["embedding"], dtype=np.float32)
    except Exception as e:
        log.error(f"Deepface error: {e}")
        return {"match": False, "studentId": None, "confidence": 0}

    best_student = None
    best_score = -1.0
    for sid, student_emb in enrolled.items():
        score = _cosine_similarity(face_emb, student_emb)
        if score > best_score:
            best_score = score
            best_student = sid

    if best_student and best_score >= (1.0 - THRESHOLD):
        return {"match": True, "studentId": best_student, "confidence": round(best_score * 100, 2)}

    return {"match": False, "studentId": None, "confidence": round(best_score * 100, 2)}

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "detector": DETECTOR}
