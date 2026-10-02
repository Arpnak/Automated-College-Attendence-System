import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ScanFace } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import TextField from '../../components/atoms/TextField';
import Button from '../../components/atoms/Button';

const ROLES = [
  { value: 'student',   label: 'Student',   desc: 'Attend classes & track attendance' },
  { value: 'professor', label: 'Professor',  desc: 'Manage courses & run sessions' },
  { value: 'admin',     label: 'Admin',      desc: 'Administer your institution' },
];

const REDIRECT = { admin: '/admin/dashboard', professor: '/professor/courses', student: '/student/dashboard' };

export default function SignupPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const user = await register({ name: form.name, email: form.email, password: form.password, role });
      toast.success('Account created — welcome to AttendX!');
      navigate(REDIRECT[user.role] || '/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-scan-500/15 text-scan-500">
            <ScanFace size={22} />
          </div>
          <h1 className="font-display text-xl font-semibold text-mist">Create your account</h1>
          <p className="text-sm text-fog">Register as admin, professor, or student.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {/* Role Selector */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-950 dark:text-mist">I am a…</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all ${
                    role === r.value
                      ? 'border-scan-500 bg-scan-500/10 text-scan-500'
                      : 'border-ink-700/30 text-fog hover:border-ink-500 hover:text-mist'
                  }`}
                >
                  <span className="text-xs font-semibold">{r.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <TextField
            label="Full name"
            required
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            placeholder="Min. 6 characters"
          />
          <TextField
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
          />

          {error && <p role="alert" className="text-xs font-medium text-status-absent">{error}</p>}

          <Button type="submit" icon={UserPlus} loading={loading} className="w-full">
            Create account
          </Button>

          <p className="text-center text-xs text-fog">
            Already have an account?{' '}
            <Link to="/login" className="text-scan-500 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
