import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, CheckCircle2, AlertTriangle, X, RefreshCw, ShieldCheck
} from 'lucide-react';
import Button from '../../components/atoms/Button';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { uploadFacePhoto, getOnboardStatus } from '../../services/onboardService';

const REQUIRED = 2;   // minimum photos needed
const MAX      = 3;   // maximum allowed

// ── Photo Slot ────────────────────────────────────────────────────────────────
function PhotoSlot({ index, photo, onCapture, onRemove, disabled }) {
  return (
    <div className="flex flex-col gap-2 items-center">
      <div className={`relative w-28 h-28 rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-colors
        ${photo?.done
          ? 'border-status-present bg-status-present/10'
          : photo?.preview
          ? 'border-scan-500/60 bg-ink-800/40'
          : 'border-dashed border-ink-700/30 bg-ink-800/20 hover:border-scan-500/50'}`}
      >
        {photo?.preview ? (
          <>
            <img src={photo.preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
            {photo.done && (
              <div className="absolute inset-0 flex items-center justify-center bg-status-present/20">
                <CheckCircle2 size={28} className="text-status-present drop-shadow" />
              </div>
            )}
            {!photo.done && !photo.uploading && (
              <button
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X size={12} />
              </button>
            )}
            {photo.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <RefreshCw size={20} className="text-white animate-spin" />
              </div>
            )}
          </>
        ) : (
          <span className="text-2xl font-bold text-fog/40">{index + 1}</span>
        )}
      </div>
      <p className="text-[11px] text-fog text-center">
        {photo?.done ? 'Uploaded ✓' : photo?.preview ? 'Ready' : `Photo ${index + 1}`}
      </p>
    </div>
  );
}

// ── Live Camera Modal ─────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setReady(true);
        }
      })
      .catch((e) => setError(e.message || 'Camera access denied'));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video  = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `live-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden bg-ink-900 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700/40">
          <p className="text-sm font-semibold text-mist">Take a photo</p>
          <button onClick={onClose} className="text-fog hover:text-mist"><X size={18} /></button>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle size={32} className="text-status-absent" />
            <p className="text-sm text-fog">{error}</p>
            <p className="text-xs text-fog/60">Grant camera permission and try again.</p>
          </div>
        ) : (
          <>
            <div className="relative bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-52 rounded-full border-2 border-white/40 border-dashed" />
              </div>
            </div>
            <div className="flex justify-center gap-3 p-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button icon={Camera} disabled={!ready} onClick={capture}>
                Capture
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main OnboardPage ──────────────────────────────────────────────────────────
export default function OnboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate  = useNavigate();
  const fileInputRef = useRef(null);
  const [slotTarget, setSlotTarget] = useState(null); // which slot file-picker targets

  // 3 photo slots: null | { file, preview, uploading, done, error }
  const [photos, setPhotos] = useState([null, null, null]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [allDone, setAllDone]       = useState(false);

  // Load existing status on mount (student may have already uploaded some)
  useEffect(() => {
    getOnboardStatus().then((s) => {
      if (s?.profileComplete) setAllDone(true);
    }).catch(() => {});
  }, []);

  const uploadedCount = photos.filter((p) => p?.done).length;
  const profileComplete = uploadedCount >= REQUIRED;

  const updateSlot = (index, patch) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...prev[index], ...patch };
      return next;
    });
  };

  const addPhotoFile = useCallback((file, index) => {
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { file, preview, uploading: false, done: false, error: null };
      return next;
    });
  }, []);

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(prev[index]?.preview);
      next[index] = null;
      return next;
    });
  };

  // Find the next empty slot index
  const nextSlot = () => photos.findIndex((p) => !p);

  const openFilePicker = (index) => {
    const slot = index ?? nextSlot();
    if (slot === -1) return;
    setSlotTarget(slot);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const openCamera = (index) => {
    const slot = index ?? nextSlot();
    if (slot === -1) return;
    setSlotTarget(slot);
    setCameraOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || slotTarget === null) return;
    addPhotoFile(file, slotTarget);
    e.target.value = '';
    setSlotTarget(null);
  };

  const uploadAll = async () => {
    const toUpload = photos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p && !p.done && !p.uploading);

    if (!toUpload.length) return;

    for (const { p, i } of toUpload) {
      updateSlot(i, { uploading: true, error: null });
      try {
        await uploadFacePhoto(p.file, i + 1);
        updateSlot(i, { uploading: false, done: true });
        toast.success(`Photo ${i + 1} uploaded ✓`);
      } catch (err) {
        updateSlot(i, { uploading: false, error: err.message });
        toast.error(`Photo ${i + 1}: ${err.message}`);
      }
    }

    const doneCount = photos.filter((p) => p?.done).length + toUpload.filter(({ p }) => !p.error).length;
    if (doneCount >= REQUIRED) setAllDone(true);
  };

  const pendingCount = photos.filter((p) => p && !p.done).length;

  return (
    <>
      {cameraOpen && (
        <CameraModal
          onCapture={(file) => {
            if (slotTarget !== null) addPhotoFile(file, slotTarget);
            setCameraOpen(false);
            setSlotTarget(null);
          }}
          onClose={() => { setCameraOpen(false); setSlotTarget(null); }}
        />
      )}

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-scan-900/30 p-4">
        <div className="w-full max-w-md space-y-6">

          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-14 w-14 rounded-2xl bg-scan-500/15 flex items-center justify-center">
                <Camera size={28} className="text-scan-500" />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-mist">Complete your profile</h1>
            <p className="text-sm text-fog">
              Upload <strong className="text-mist">2–3 clear photos</strong> of your face so the system can recognise you in class.
            </p>
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-2 rounded-xl bg-status-present/8 border border-status-present/20 px-4 py-3 text-xs text-status-present">
            <ShieldCheck size={15} className="shrink-0 mt-0.5" />
            <span>Photos are processed immediately — only your face embedding is stored. The original images are deleted right after processing.</span>
          </div>

          {/* Done state */}
          {allDone ? (
            <div className="card p-8 text-center space-y-4">
              <CheckCircle2 size={40} className="text-status-present mx-auto" />
              <p className="text-base font-semibold text-mist">Profile complete!</p>
              <p className="text-sm text-fog">Your face has been indexed. You can now be recognised in attendance sessions.</p>
              <Button className="w-full" onClick={() => navigate('/student/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <div className="card p-5 space-y-5">
              {/* Photo slots */}
              <div className="flex justify-around">
                {photos.map((p, i) => (
                  <PhotoSlot
                    key={i}
                    index={i}
                    photo={p}
                    onCapture={(file) => addPhotoFile(file, i)}
                    onRemove={removePhoto}
                    disabled={p?.uploading}
                  />
                ))}
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-fog">
                  <span>{uploadedCount} / {MAX} uploaded</span>
                  <span className={profileComplete ? 'text-status-present' : ''}>
                    {profileComplete ? 'Minimum met ✓' : `Need ${REQUIRED - uploadedCount} more`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-700/30">
                  <div
                    className="h-1.5 rounded-full bg-scan-500 transition-all duration-500"
                    style={{ width: `${(uploadedCount / MAX) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openFilePicker(null)}
                  disabled={nextSlot() === -1}
                  className="flex items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800/60 px-3 py-2.5 text-sm text-mist hover:bg-ink-700/60 disabled:opacity-40 transition-colors"
                >
                  <Upload size={16} /> Upload file
                </button>
                <button
                  onClick={() => openCamera(null)}
                  disabled={nextSlot() === -1}
                  className="flex items-center justify-center gap-2 rounded-xl border border-scan-500/40 bg-scan-500/10 px-3 py-2.5 text-sm text-scan-400 hover:bg-scan-500/20 disabled:opacity-40 transition-colors"
                >
                  <Camera size={16} /> Live camera
                </button>
              </div>

              {/* Upload button */}
              {pendingCount > 0 && (
                <Button
                  className="w-full"
                  onClick={uploadAll}
                  loading={photos.some((p) => p?.uploading)}
                >
                  Upload {pendingCount} photo{pendingCount > 1 ? 's' : ''}
                </Button>
              )}

              {/* Error display */}
              {photos.some((p) => p?.error) && (
                <div className="space-y-1">
                  {photos.filter((p) => p?.error).map((p, i) => (
                    <p key={i} className="text-xs text-status-absent flex items-center gap-1">
                      <AlertTriangle size={12} /> {p.error}
                    </p>
                  ))}
                </div>
              )}

              {profileComplete && (
                <Button variant="secondary" className="w-full" onClick={() => navigate('/student/dashboard')}>
                  Continue to Dashboard →
                </Button>
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </>
  );
}
