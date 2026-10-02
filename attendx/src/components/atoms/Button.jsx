import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-scan-500 text-ink-950 hover:bg-scan-400 focus-visible:ring-scan-500 disabled:bg-scan-500/40',
  secondary: 'bg-ink-800 text-mist border border-ink-600 hover:bg-ink-700 disabled:opacity-40',
  ghost: 'bg-transparent text-fog hover:bg-ink-800 hover:text-mist disabled:opacity-40',
  danger: 'bg-status-absent text-white hover:brightness-110 disabled:opacity-40',
};
const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors
        disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
