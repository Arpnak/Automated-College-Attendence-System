import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../../components/atoms/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 px-4 text-center">
      <Compass size={32} className="text-scan-500" />
      <h1 className="font-display text-xl font-semibold text-mist">Page not found</h1>
      <p className="max-w-sm text-sm text-fog">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/login">
        <Button variant="secondary">Back to sign in</Button>
      </Link>
    </div>
  );
}
