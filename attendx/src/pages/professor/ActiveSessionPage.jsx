import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, StopCircle, WifiOff, AlertTriangle, CheckCircle2, Clock, UserSearch } from 'lucide-react';
import Button from '../../components/atoms/Button';
import ConnectionIndicator from '../../components/atoms/ConnectionIndicator';
import RosterGrid from '../../components/molecules/RosterGrid';
import FileUploadZone from '../../components/molecules/FileUploadZone';
import Modal from '../../components/atoms/Modal';
import CameraModal from '../../components/organisms/CameraModal';
import { useRecognitionSocket } from '../../hooks/useRecognitionSocket';
import * as sessionService from '../../services/sessionService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export default function ActiveSessionPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { setActiveSession } = useAuth();
  const { toast } = useToast();

  const [session] = useState(state?.session || null);
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [batchCount, setBatchCount] = useState(0);
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [forceEndAvailable, setForceEndAvailable] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // ghost face being assigned
  const [cameraOpen, setCameraOpen] = useState(false);

  const {
    roster,
    connection,
    reviewQueue,
    unidentifiedQueue,
    processingComplete,
    indexingStatus,
    simulateDisconnect,
    overrideStatus,
    resolveReview,
    resolveUnidentified,
    socketRef,
  } = useRecognitionSocket(sessionId, session?.roster || []);

  // Listen for SESSION_FINALIZED event from socket to auto-close
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const handler = () => {
      setEnded(true);
      setActiveSession(null);
    };
    sock.addEventListener('_sessionFinalized', handler);
    return () => sock.removeEventListener('_sessionFinalized', handler);
  }, [socketRef, setActiveSession]);

  const presentCount = roster.filter((s) => s.status === 'present').length;
  const percentRecognized = roster.length ? Math.round((presentCount / roster.length) * 100) : 0;

  // C10: session is indexing if backend says so or indexingStatus is 'indexing'
  const isIndexing =
    session?.status === 'indexing' ||
    (indexingStatus && indexingStatus.status === 'indexing');

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle size={24} className="text-status-review" />
        <p className="text-sm text-fog">
          Session not found in memory — likely a page refresh. Start a new session from the Course Hub.
        </p>
        <Button variant="secondary" onClick={() => navigate('/professor/courses')}>
          Back to Course Hub
        </Button>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUpload = async (files) => {
    if (isIndexing) {
      toast.warning('Cannot capture while the course is still indexing student faces.');
      return;
    }
    setUploading(true);
    setUploads(files.map((f) => ({ name: f.name, pct: 0 })));
    try {
      await sessionService.uploadImageBatch(sessionId, files, (name, pct) => {
        setUploads((prev) => prev.map((u) => (u.name === name ? { ...u, pct } : u)));
      });
      const nextBatch = batchCount + 1;
      setBatchCount(nextBatch);
      toast.success(`Photo ${nextBatch}/3 uploaded — processing faces…`);
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = (student) => {
    const next = student.status === 'present' ? 'absent' : 'present';
    overrideStatus(student.id, next);
    sessionService.overrideAttendance(sessionId, student.id, next).catch(() => {
      toast.error(`Couldn't save override for ${student.name}, reverting.`);
      overrideStatus(student.id, student.status);
    });
  };

  const handleResolveReview = (studentId, finalStatus) => {
    resolveReview(studentId, finalStatus);
    sessionService.overrideAttendance(sessionId, studentId, finalStatus).catch(() => {
      toast.error('Could not save review decision.');
    });
  };

  const handleAssignGhostFace = async (face, studentId) => {
    try {
      await sessionService.assignUnidentifiedFace(sessionId, face.faceId, studentId);
      resolveUnidentified(face.faceId, studentId);
      toast.success('Face assigned — student marked present.');
    } catch (err) {
      toast.error(`Assignment failed: ${err.message}`);
    }
    setAssignTarget(null);
  };

  const confirmEndSession = async () => {
    setEnding(true);
    try {
      await sessionService.endSession(sessionId, forceEndAvailable);
      setEnded(true);
      setActiveSession(null);
      toast.success('Session ended — raw images deleted from Cloudinary.');
      setConfirmEnd(false);
    } catch (err) {
      if (err.message?.includes('Still processing') || err.code === 'CROPS_PENDING') {
        toast.error(err.message);
        setForceEndAvailable(true);
      } else {
        toast.error(err.message);
        setConfirmEnd(false);
      }
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="space-y-6">
      {cameraOpen && (
        <CameraModal
          onCapture={(file) => handleUpload([file])} // wrap in array for handleUpload
          onClose={() => setCameraOpen(false)}
        />
      )}
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-fog">
            {session.startedAt ? `Session started ${new Date(session.startedAt).toLocaleTimeString()}` : 'Active Session Restored'}
          </p>
          <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">
            {session.courseName} — Active Session
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionIndicator status={connection.status} attempt={connection.attempt} />
          {!ended && (
            <Button variant="danger" size="sm" icon={StopCircle} onClick={() => setConfirmEnd(true)}>
              End Session
            </Button>
          )}
        </div>
      </div>

      {/* ── C7 Privacy badge ── */}
      {ended && (
        <div className="flex items-center gap-2 rounded-lg bg-status-present/10 px-4 py-3 text-sm font-medium text-status-present">
          <ShieldCheck size={18} />
          Zero-Trust Privacy: Images Deleted — session closed at {percentRecognized}% recognized.
        </div>
      )}

      {/* ── C10 Indexing gate banner ── */}
      {isIndexing && !ended && (
        <div className="flex items-center gap-2 rounded-lg bg-status-review/10 px-4 py-3 text-sm font-medium text-status-review">
          <Clock size={18} />
          Indexing student faces{' '}
          {indexingStatus?.progress != null ? `(${indexingStatus.progress}%)` : '…'}
          — photo capture will unlock once all enrolled students are indexed.
        </div>
      )}

      {/* ── C1 Processing complete badge ── */}
      {processingComplete && !ended && (
        <div className="flex items-center gap-2 rounded-lg bg-scan-500/10 px-4 py-3 text-sm font-medium text-scan-600 dark:text-scan-400">
          <CheckCircle2 size={18} />
          Processing complete — {processingComplete.totalMatched} of{' '}
          {processingComplete.totalDetected} detected faces matched. You may now finalize the session.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* ── Action Panel ── */}
        <div className="space-y-4">
          {/* Upload zone */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-ink-950 dark:text-mist">Capture attendance</h2>
            <FileUploadZone
              onFilesReady={handleUpload}
              onCameraClick={() => setCameraOpen(true)}
              disabled={uploading || ended || isIndexing}
            />
            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div key={u.name}>
                    <div className="flex justify-between text-[11px] text-fog">
                      <span className="truncate">{u.name}</span>
                      <span>{Math.round(u.pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-700/20 dark:bg-ink-700">
                      <div
                        className="h-1.5 rounded-full bg-scan-500 transition-all"
                        style={{ width: `${u.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-fog">Batches uploaded: {batchCount}/3 recommended</p>
          </div>

          {/* Recognition progress */}
          <div className="card p-4 space-y-2">
            <h2 className="text-sm font-semibold text-ink-950 dark:text-mist">Recognition progress</h2>
            <div className="h-2 rounded-full bg-ink-700/20 dark:bg-ink-700">
              <div
                className="h-2 rounded-full bg-status-present transition-all"
                style={{ width: `${percentRecognized}%` }}
              />
            </div>
            <p className="text-xs text-fog">
              {presentCount} of {roster.length} students recognized ({percentRecognized}%)
            </p>
          </div>

          {/* Low-confidence review queue */}
          {reviewQueue.length > 0 && (
            <div className="card p-4 space-y-2 border-status-review/40">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-status-review">
                <AlertTriangle size={15} /> Needs Review ({reviewQueue.length})
              </h2>
              <div className="space-y-2">
                {reviewQueue.map((r) => {
                  const student = roster.find((s) => s.id === r.studentId);
                  if (!student) return null;
                  return (
                    <div key={r.studentId} className="flex items-center justify-between text-xs">
                      <span className="text-ink-950 dark:text-mist">
                        {student.name}{' '}
                        <span className="text-fog">({Math.round(r.confidence)}%)</span>
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResolveReview(r.studentId, 'absent')}
                        >
                          Absent
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleResolveReview(r.studentId, 'present')}
                        >
                          Present
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unidentified ghost faces (C9) */}
          {unidentifiedQueue.length > 0 && (
            <div className="card p-4 space-y-3 border-fog/30">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fog">
                <UserSearch size={15} /> Unidentified ({unidentifiedQueue.length})
              </h2>
              <div className="space-y-3">
                {unidentifiedQueue.map((f) => (
                  <div key={f.faceId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {f.cropUrl && (
                        <img
                          src={f.cropUrl}
                          alt="unknown face"
                          className="h-10 w-10 rounded-md object-cover border border-ink-700/20"
                        />
                      )}
                      <span className="text-xs text-fog">
                        Conf: {Math.round(f.confidence)}% — not matched
                      </span>
                    </div>
                    {assignTarget?.faceId === f.faceId ? (
                      <div className="flex gap-1 flex-wrap">
                        <select
                          className="flex-1 rounded border border-ink-700/30 bg-surface px-2 py-1 text-xs text-ink-950 dark:text-mist"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleAssignGhostFace(f, e.target.value);
                          }}
                        >
                          <option value="" disabled>Assign to student…</option>
                          {roster.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <Button size="sm" variant="ghost" onClick={() => setAssignTarget(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAssignTarget(f)}
                      >
                        Assign student
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug disconnect */}
          <button
            onClick={simulateDisconnect}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-700/40 py-2 text-[11px] text-fog hover:text-mist"
          >
            <WifiOff size={12} /> Debug: simulate disconnect
          </button>
        </div>

        {/* ── Live Roster Grid ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-950 dark:text-mist">
            Live roster — click to override
          </h2>
          <RosterGrid students={roster} onToggle={handleToggle} interactive={!ended} />
        </div>
      </div>

      {/* ── End Session Confirmation Modal ── */}
      <Modal
        open={confirmEnd}
        onClose={() => { setConfirmEnd(false); setForceEndAvailable(false); }}
        title="End session?"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConfirmEnd(false); setForceEndAvailable(false); }}>Cancel</Button>
            <Button variant="danger" loading={ending} onClick={confirmEndSession}>
              {forceEndAvailable ? 'Force End Session' : 'End session'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fog">
          {roster.length - presentCount} student(s) are still pending or under review. Ending now
          marks them absent, permanently deletes the session images from Cloudinary, and closes
          the session.
        </p>
        {forceEndAvailable && (
          <div className="mt-3 rounded bg-status-review/10 p-3 text-xs text-status-review font-medium">
            Warning: The server still thinks faces are being processed. If you are stuck, you can force-end the session now.
          </div>
        )}
      </Modal>
    </div>
  );
}
