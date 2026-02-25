import { X, Lock } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../types/user';

interface LockUserDialogProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: number, durationHours: number) => void;
}

export function LockUserDialog({ isOpen, user, onClose, onConfirm }: LockUserDialogProps) {
  const [duration, setDuration] = useState<number>(24);

  if (!isOpen || !user) return null;

  const handleConfirm = () => {
    onConfirm(user.id, duration);
    onClose();
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
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Khoá tài khoản
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Khoá tài khoản <strong className="text-foreground">{user.email}</strong>? Người dùng sẽ không thể đăng nhập cho đến khi khoá hết hạn.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Lock Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-all"
          >
            <option value={1}>1 giờ</option>
            <option value={24}>24 giờ (1 ngày)</option>
            <option value={168}>7 ngày</option>
            <option value={720}>30 ngày</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors cursor-pointer"
          >
            Khoá tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
