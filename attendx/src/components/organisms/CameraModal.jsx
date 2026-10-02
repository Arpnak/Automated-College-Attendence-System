import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Camera, X } from 'lucide-react';
import Button from '../atoms/Button';

export default function CameraModal({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
