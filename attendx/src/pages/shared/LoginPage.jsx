import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ScanFace, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import TextField from '../../components/atoms/TextField';
import Button from '../../components/atoms/Button';

const ROLE_HOME = {
  super_admin: '/superadmin/dashboard',
  admin: '/admin/dashboard',
  professor: '/professor/courses',
  student: '/student/dashboard',
};


export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form);
      const from = location.state?.from;
      navigate(from || ROLE_HOME[user.role] || '/', { replace: true });
      toast.success(`Signed in as ${user.name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-scan-500/15 text-scan-500">
            <ScanFace size={22} />
          </div>
          <h1 className="font-display text-xl font-semibold text-mist">Sign in to AttendX</h1>
          <p className="text-sm text-fog">Admin, professor, or student — one login.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@attendx.edu"
          />
          <TextField
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
          {error && <p role="alert" className="text-xs font-medium text-status-absent">{error}</p>}
          <Button type="submit" icon={LogIn} loading={loading} className="w-full">
            Sign in
          </Button>
          <p className="text-center text-xs text-fog">
            Have a private key from your admin?{' '}
            <Link to="/signup" className="text-scan-500 hover:underline">
              Register as a student
            </Link>
          </p>
          <p className="text-center text-[11px] text-fog/70">
            Demo: try priya@attendx.edu / reyes@attendx.edu / jblake@attendx.edu (any password)
          </p>
        </form>
      </div>
    </div>
  );
}
