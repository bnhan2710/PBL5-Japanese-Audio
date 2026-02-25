import { Edit, Lock, Unlock, KeyRound, MoreVertical } from 'lucide-react';
import type { User } from '../types/user';
import { useState, useRef, useEffect } from 'react';

interface UserRowProps {
  user: User;
  onEdit: (user: User) => void;
  onLock: (user: User) => void;
  onUnlock: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export function UserRow({ user, onEdit, onLock, onUnlock, onResetPassword }: UserRowProps) {
  const [showActions, setShowActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    if (showActions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-violet-100 text-violet-900 border border-violet-200 dark:bg-violet-900/50 dark:text-violet-200 dark:border-violet-700';
      case 'user':
        return 'bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      {/* User info */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username}
              className="w-9 h-9 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-border">
              {(user.first_name?.[0] || user.username[0]).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground leading-tight">
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username}
            </p>
            <p className="text-[11px] text-muted-foreground/90 mt-0.5 font-medium">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${roleBadge(user.role)}`}>
          {user.role}
        </span>
      </td>

      {/* Active status */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
          user.is_active
            ? 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800'
            : 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {user.is_active ? 'Hoạt động' : 'Vô hiệu'}
        </span>
      </td>

      {/* Lock status */}
      <td className="px-6 py-4">
        {isLocked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Đang bị khoá
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Created */}
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {new Date(user.created_at).toLocaleDateString('vi-VN')}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="relative inline-block" ref={menuRef}>
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showActions && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-card rounded-lg shadow-lg border border-border py-1 z-50">
              <button
                onClick={() => { onEdit(user); setShowActions(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors text-foreground"
              >
                <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                Chỉnh sửa
              </button>

              {isLocked ? (
                <button
                  onClick={() => { onUnlock(user); setShowActions(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors text-foreground"
                >
                  <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                  Mở khoá
                </button>
              ) : (
                <button
                  onClick={() => { onLock(user); setShowActions(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors text-foreground"
                >
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Khoá tài khoản
                </button>
              )}

              <button
                onClick={() => { onResetPassword(user); setShowActions(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors text-foreground"
              >
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                Đặt lại mật khẩu
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
