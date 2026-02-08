import { Edit, Lock, Unlock, KeyRound, MoreVertical } from 'lucide-react';
import type { User } from '../types/user';
import { useState } from 'react';

interface UserRowProps {
  user: User;
  onEdit: (user: User) => void;
  onLock: (user: User) => void;
  onUnlock: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export function UserRow({ user, onEdit, onLock, onUnlock, onResetPassword }: UserRowProps) {
  const [showActions, setShowActions] = useState(false);
  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'user':
        return 'bg-blue-100 text-blue-700';
      case 'guest':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900">{user.email}</div>
        <div className="text-sm text-slate-500">{user.username}</div>
      </td>

      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
          {user.role}
        </span>
      </td>

      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td className="px-6 py-4">
        {isLocked ? (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            Locked
          </span>
        ) : (
          <span className="text-sm text-slate-500">-</span>
        )}
      </td>

      <td className="px-6 py-4 text-sm text-slate-500">
        {new Date(user.created_at).toLocaleDateString()}
      </td>

      <td className="px-6 py-4">
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <MoreVertical className="w-5 h-5 text-slate-600" />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
              <button
                onClick={() => { onEdit(user); setShowActions(false); }}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>

              {isLocked ? (
                <button
                  onClick={() => { onUnlock(user); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock
                </button>
              ) : (
                <button
                  onClick={() => { onLock(user); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  Lock Account
                </button>
              )}

              <button
                onClick={() => { onResetPassword(user); setShowActions(false); }}
                className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                Reset Password
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
