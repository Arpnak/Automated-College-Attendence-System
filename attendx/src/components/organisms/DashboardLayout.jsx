import { Outlet, Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../../hooks/useAuth';

// Gap #7: a persistent lock banner so a professor can't lose track of (or
// accidentally start a second) live session while navigating elsewhere.
export default function DashboardLayout() {
  const { activeSession } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 dark:bg-ink-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        {activeSession && (
          <Link
            to={`/professor/session/${activeSession.sessionId}`}
            className="flex items-center justify-center gap-2 bg-scan-500/12 px-4 py-2 text-xs font-medium text-scan-500 hover:bg-scan-500/20"
          >
            <Radio size={13} className="animate-pulse" />
            Session live for {activeSession.courseName} — click to return
          </Link>
        )}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
