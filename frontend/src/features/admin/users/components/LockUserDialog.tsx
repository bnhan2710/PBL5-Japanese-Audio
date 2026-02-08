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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Lock className="w-6 h-6 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Fira Code, monospace' }}>
            Lock User Account
          </h2>
        </div>

        <p className="text-slate-600 mb-6">
          Lock account for <strong>{user.email}</strong>? User will not be able to login until the lock expires.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Lock Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent cursor-pointer transition-all"
          >
            <option value={1}>1 Hour</option>
            <option value={24}>24 Hours (1 Day)</option>
            <option value={168}>7 Days</option>
            <option value={720}>30 Days</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
          >
            Lock Account
          </button>
        </div>
      </div>
    </div>
  );
}
