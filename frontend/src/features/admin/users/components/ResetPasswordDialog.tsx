import { X, KeyRound, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  tempPassword: string | null;
  userEmail: string | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ isOpen, tempPassword, userEmail, onClose }: ResetPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !tempPassword) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 relative border border-border">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer text-muted-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <KeyRound className="w-6 h-6 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Fira Code, monospace' }}>
            Password Reset
          </h2>
        </div>

        <p className="text-muted-foreground mb-4">
          Password has been reset for <strong>{userEmail}</strong>
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-2">Temporary Password:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-background border border-border rounded-lg font-mono text-sm text-foreground">
              {tempPassword}
            </code>
            <button
              onClick={handleCopy}
              className="p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-500">
            ℹ️ This password has also been sent to the user's email address.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
