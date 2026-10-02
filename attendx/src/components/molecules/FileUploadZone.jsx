import { useRef, useState } from 'react';
import { Camera, ImagePlus, X, AlertCircle } from 'lucide-react';

// Gap #5: strict client-side enforcement of exactly 3 images. Selecting
// 1, 2, or 4+ shows an inline error instead of silently failing or
// truncating the selection.
const REQUIRED_COUNT = 3;

export default function FileUploadZone({ onFilesReady, onCameraClick, disabled = false }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    if (arr.length !== REQUIRED_COUNT) {
      setError(`Select exactly ${REQUIRED_COUNT} photos in a row — you selected ${arr.length}.`);
      setFiles([]);
      return;
    }
    setError('');
    setFiles(arr);
    onFilesReady?.(arr);
  };

  const clear = () => {
    setFiles([]);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors
          ${error ? 'border-status-absent/60 bg-status-absent/5' : 'border-ink-700/30 dark:border-ink-600 hover:border-scan-500/50'}`}
      >
        <ImagePlus size={22} className="text-fog" />
        <p className="text-sm text-ink-950 dark:text-mist">Select exactly 3 photos in a row</p>
        <p className="text-xs text-fog">Or use the camera to capture a live burst</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-scan-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-scan-400 disabled:opacity-40"
          >
            <ImagePlus size={14} /> Choose photos
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (onCameraClick) onCameraClick();
              else inputRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-mist hover:bg-ink-800 disabled:opacity-40"
          >
            <Camera size={14} /> Use camera
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-status-absent">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      {files.length === REQUIRED_COUNT && (
        <div className="flex items-center justify-between rounded-lg bg-status-present/10 px-3 py-2 text-xs text-status-present">
          <span>{files.length} photos ready to upload</span>
          <button onClick={clear} className="text-fog hover:text-mist" aria-label="Clear selection">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
