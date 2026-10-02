export default function TextField({ label, error, className = '', id, ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-950 dark:text-mist">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border bg-white dark:bg-ink-800 px-3 py-2 text-sm text-ink-950 dark:text-mist
          placeholder:text-fog/70 focus-visible:ring-2 focus-visible:ring-scan-500 outline-none
          ${error ? 'border-status-absent' : 'border-ink-700/30 dark:border-ink-600'}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="text-xs text-status-absent">{error}</p>}
    </div>
  );
}
