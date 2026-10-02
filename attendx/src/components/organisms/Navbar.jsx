import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../atoms/ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-700/10 dark:border-ink-700/60 bg-white dark:bg-ink-900 px-4 md:px-6">
      <div>
        <p className="text-sm font-medium text-ink-950 dark:text-mist">Welcome back, {user?.name?.split(' ')[0]}</p>
        <p className="text-xs capitalize text-fog">
          {user?.role === 'super_admin' ? 'Platform Owner' : `${user?.role} portal`}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <button
          onClick={() => navigate('/profile')}
          aria-label="Profile"
          className="rounded-lg p-2 text-fog hover:bg-ink-800 hover:text-mist transition-colors"
        >
          <User size={18} />
        </button>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="rounded-lg p-2 text-fog hover:bg-status-absent/10 hover:text-status-absent transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
