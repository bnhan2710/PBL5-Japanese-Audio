import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { authApi } from '@/features/auth/api/authClient';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage({ type: 'error', text: 'Invalid or missing reset token.' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await authApi.resetPassword(token, password);
      setMessage({ type: 'success', text: 'Password reset successfully. Redirecting to login...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to reset password' });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center text-destructive">
          <h2 className="text-2xl font-bold">Invalid Link</h2>
          <p>The password reset link is invalid or has expired.</p>
          <Link to="/login" className="text-primary hover:underline mt-4 block">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Set new password
          </h2>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {message && (
                <div className={`p-3 text-sm rounded-md ${message.type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  {message.text}
                </div>
              )}
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
