# ClassRoll Platform - Startup Manual

This manual provides the terminal commands to start each microservice and worker of the ClassRoll platform independently from scratch.

## 1. Infrastructure (Database, Redis, Kafka)
Make sure your backing services are running before starting any node/python processes.
If using Docker:
```powershell
docker-compose up -d
```

---

## 2. Python Unified Worker (`python-worker`)
This unified FastAPI service handles face indexing (student onboarding) and face matching.

**Directory:** `python-worker`
```powershell
# Navigate to the Python worker directory
cd python-worker

# (First time only) Install dependencies
pip install -r requirements.txt

# Start the FastAPI service
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload

```

---

## 3. Python Cropper Worker (`backend/workers`)
This worker processes raw session photos, crops faces, and pushes to Kafka.

**Directory:** `backend`
```powershell
# Navigate to the backend directory
cd backend

# Start the Python Cropper worker (make sure venv is active if required)
python workers/cropper_worker.py
```

*Note: The old workers like `matcher_worker.py` and `dlq_retry_worker.py` located in this directory are deprecated and **do not need to be started**.*

---

## 4. Node.js Backend API & Gateway
This is the core Express.js API and WebSocket gateway. 

**Directory:** `backend`
```powershell
# Navigate to the backend directory
cd backend

# (First time only) Install dependencies
npm install

# Start the main backend server
npm run dev
```

---

## 5. Node.js Background Workers (Auto-Started)

**DO NOT START THESE MANUALLY.**
The Node.js background workers (`attendanceConsumer`, `cropConsumer`, `bulkWriter`, `ttlReaper`) are now **automatically started** in the background when you run `npm run dev` in the `backend` directory.

Running them in separate terminals will cause duplicate Kafka consumers, leading to constant rebalancing, dropped messages, and multiple duplicate attendance entries. 
Always let `server.js` manage the workers!

---

## 6. React Frontend (ClassRoll)
This is the Vite-based React application for students and professors.

**Directory:** `attendx`
```powershell
# Navigate to the frontend directory
cd attendx

# (First time only) Install dependencies
npm install

# Start the Vite development server
npm run dev
```
