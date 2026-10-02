# AttendX — Facial Recognition Attendance (Frontend Scaffold)

A runnable Vite + React + Tailwind scaffold implementing the full Phase 1/2
blueprint: role-based routing (Admin/Professor/Student/Shared), the atomic
component library, and the mission-critical Active Session page.

## Run it

```bash
npm install
npm run dev
```

Then sign in with any of the seeded demo accounts (any password works — this
uses an in-memory mock backend in `src/services/`, no real API yet):

- `priya@attendx.edu` — Admin
- `reyes@attendx.edu` — Professor (courses: Distributed Systems, Computer Vision)
- `jblake@attendx.edu` — Student

To try the student signup flow, use private key `ATX-7F2K-9QRT` or `ATX-3M8P-XQ21`
at `/signup`.

## Where the gap decisions live

Each of the 7 flagged assumptions from Phase 1 is implemented and commented
at its point of use:

| Gap | File |
|---|---|
| WebSocket reconnect / roster freeze | `src/hooks/useRecognitionSocket.js`, `src/services/recognitionSocket.js` |
| Protected routes (auth/role redirects) | `src/routes/ProtectedRoute.jsx` |
| Needs Review queue | `src/pages/professor/ActiveSessionPage.jsx`, `StatusBadge.jsx` |
| Force-close End Session + Zero-Trust badge | `src/pages/professor/ActiveSessionPage.jsx`, `sessionService.js` |
| Exactly-3-images upload validation | `src/components/molecules/FileUploadZone.jsx` |
| Private key lifecycle (single-use, 7-day expiry) | `src/services/adminService.js`, `authService.js`, `pages/admin/AdminKeys.jsx` |
| Persistent "Session Live" lock banner | `src/contexts/AuthContext.jsx`, `src/components/organisms/DashboardLayout.jsx` |

Theme persistence (localStorage + prefers-color-scheme) is in `src/contexts/ThemeContext.jsx`.

## Swapping in the real backend

Every file under `src/services/` is the seam for the real integration:

- `authService.js` → real `/auth/login`, `/auth/signup` endpoints
- `courseService.js`, `adminService.js` → REST CRUD
- `sessionService.js` → pre-signed S3 upload URL + `/sessions/:id/end`
- `recognitionSocket.js` → replace with a real `new WebSocket(url)` wrapper;
  `useRecognitionSocket.js` already expects `status` and `match` events, so
  no consuming component needs to change.

## Not yet built

- Node.js ingestion service (sharp cropping, Kafka producer)
- Kafka consumer workers calling Rekognition `SearchFacesByImage`
- Redis SETNX dedupe + PostgreSQL logging (currently mocked client-side)
- Real pre-signed S3 upload flow
- PostgreSQL schema (next step, per your prompt)
