export default function StatCard({ icon: Icon, label, value, accent = 'text-scan-500' }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-scan-500/10 ${accent}`}>
          <Icon size={20} />
        </div>
      )}
      <div>
        <p className="font-display text-2xl font-semibold text-ink-950 dark:text-mist">{value}</p>
        <p className="text-xs text-fog">{label}</p>
      </div>
    </div>
  );
}
