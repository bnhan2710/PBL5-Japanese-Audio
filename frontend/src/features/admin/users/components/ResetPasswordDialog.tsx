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
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Đặt lại mật khẩu
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Đã đặt lại mật khẩu cho <strong className="text-foreground">{userEmail}</strong>.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-xs text-muted-foreground mb-2">Mật khẩu tạm thời:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg font-mono text-sm text-foreground">
              {tempPassword}
            </code>
            <button
              onClick={handleCopy}
              className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg p-3 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            ℹ️ Mật khẩu này cũng đã được gửi đến email của người dùng.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
