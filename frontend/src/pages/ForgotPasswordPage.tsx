import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await authApi.requestPasswordReset(email);
      setMessage({
        type: 'success',
        text: 'If an account exists with this email, you will receive a password reset link.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to request password reset' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>Enter your email to receive a reset link</CardDescription>
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
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Reset Link
              </Button>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to Login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
