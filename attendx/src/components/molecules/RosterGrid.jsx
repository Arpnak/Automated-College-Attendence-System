import RosterRow from './RosterRow';
import EmptyState from '../atoms/EmptyState';
import { Users } from 'lucide-react';

export default function RosterGrid({ students, onToggle, interactive = true }) {
  if (!students?.length) {
    return <EmptyState icon={Users} title="No students yet" description="Once students enroll, they'll appear here." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {students.map((s) => (
        <RosterRow key={s.id} student={s} onToggle={onToggle} interactive={interactive} />
      ))}
    </div>
  );
}
