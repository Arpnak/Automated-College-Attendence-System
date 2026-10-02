# AttendX — Backend

# admin credential
- Email: arpna@classroll.in
- Password: arpna@1234

## Quick Start

### Prerequisites
- Node.js 18+, Docker Desktop (Postgres + Redis), Kafka+Zookeeper already running on port 9092
- Python 3.10+ for the workers

### 1 — Fill in credentials
Edit `backend/.env` and paste your values:

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional — only if you have AWS credentials:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### 2 — Start Postgres + Redis
```powershell
cd backend
docker-compose up -d
```

### 3 — Run database migration
```powershell
node src/db/migrate.js
```

### 4 — Start the Node.js API Gateway
```powershell
node src/server.js
# → http://localhost:3001
```

### 5 — Start the Python workers (each in its own terminal)
```powershell
cd backend/workers
pip install -r requirements.txt

# Terminal A — Cropper Worker
python cropper_worker.py

# Terminal B — Matcher Worker + face-indexing FastAPI server
uvicorn matcher_worker:app --host 0.0.0.0 --port 8001

# Terminal C — DLQ Retry Worker
python dlq_retry_worker.py
```

### 6 — Start the frontend
```powershell
cd attendx
npm run dev
# → http://localhost:5173
```

---

## Architecture at a glance

```
Browser → Vite proxy → Node.js :3001
                           │
                     Kafka :9092
                    /           \
          Cropper Worker    Matcher Worker :8001
                                 │
                            Redis :6379
                                 │
                          Postgres :5432
```

## Face Recognition Modes

| Mode | When | What happens |
|---|---|---|
| **AWS Rekognition** | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` set | Rekognition IndexFaces / SearchFacesByImage — fast, managed |
| **Local DeepFace** | AWS vars empty (default) | VGG-Face embeddings stored in `face_embeddings` table — no AWS needed |

## Key Kafka Topics

| Topic | Producer | Consumer |
|---|---|---|
| `attendx.raw-image.v1` | Node.js gateway | Cropper Worker |
| `attendx.face-crop.v1` | Cropper Worker | Matcher Worker |
| `attendx.face-match-dlq.v1` | Matcher Worker | DLQ Retry Worker |
