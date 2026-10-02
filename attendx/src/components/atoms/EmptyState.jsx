import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-700/40 py-12 text-center">
      <Icon size={28} className="text-fog" />
      <div>
        <p className="font-medium text-ink-950 dark:text-mist">{title}</p>
        {description && <p className="mt-1 text-sm text-fog">{description}</p>}
      </div>
      {action}
    </div>
  );
}
