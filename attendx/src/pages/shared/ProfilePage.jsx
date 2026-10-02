import { useAuth } from '../../hooks/useAuth';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-semibold text-ink-950 dark:text-mist">Profile</h1>
      <div className="card mt-4 divide-y divide-ink-700/10 dark:divide-ink-700/60">
        {[
          ['Name', user?.name],
          ['Email', user?.email],
          ['Role', user?.role],
          ...(user?.studentId ? [['Student ID', user.studentId]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-fog">{label}</span>
            <span className="text-sm font-medium capitalize text-ink-950 dark:text-mist">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
