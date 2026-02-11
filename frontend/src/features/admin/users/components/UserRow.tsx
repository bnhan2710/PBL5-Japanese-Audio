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
        return 'bg-purple-500/10 text-purple-500';
      case 'user':
        return 'bg-blue-500/10 text-blue-500';
      case 'guest':
        return 'bg-slate-500/10 text-slate-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-foreground">{user.email}</div>
        <div className="text-sm text-muted-foreground">{user.username}</div>
      </td>

      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
          {user.role}
        </span>
      </td>

      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          user.is_active ? 'bg-green-100/10 text-green-500' : 'bg-red-100/10 text-red-500'
        }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td className="px-6 py-4">
        {isLocked ? (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100/10 text-orange-500">
            Locked
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>

      <td className="px-6 py-4 text-sm text-muted-foreground">
        {new Date(user.created_at).toLocaleDateString()}
      </td>

      <td className="px-6 py-4">
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-xl border border-border py-1 z-50">
              <button
                onClick={() => { onEdit(user); setShowActions(false); }}
                className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors cursor-pointer text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>

              {isLocked ? (
                <button
                  onClick={() => { onUnlock(user); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors cursor-pointer text-sm"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock
                </button>
              ) : (
                <button
                  onClick={() => { onLock(user); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors cursor-pointer text-sm"
                >
                  <Lock className="w-4 h-4" />
                  Lock Account
                </button>
              )}

              <button
                onClick={() => { onResetPassword(user); setShowActions(false); }}
                className="w-full px-4 py-2 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors cursor-pointer text-sm"
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
