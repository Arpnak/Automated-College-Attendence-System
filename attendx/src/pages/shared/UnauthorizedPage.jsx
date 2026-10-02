import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import Button from '../../components/atoms/Button';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 px-4 text-center">
      <ShieldAlert size={32} className="text-status-review" />
      <h1 className="font-display text-xl font-semibold text-mist">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-fog">
        Your account role doesn't include this area. If you think that's wrong, contact your administrator.
      </p>
      <Link to="/login">
        <Button variant="secondary">Back to sign in</Button>
      </Link>
    </div>
  );
}
