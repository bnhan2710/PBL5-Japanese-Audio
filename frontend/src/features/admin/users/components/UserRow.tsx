import { Edit, Lock, Unlock, KeyRound } from 'lucide-react'
import type { User } from '../types/user'

interface UserRowProps {
  user: User
  onEdit: (user: User) => void
  onLock: (user: User) => void
  onUnlock: (user: User) => void
  onResetPassword: (user: User) => void
}

export function UserRow({ user, onEdit, onLock, onUnlock, onResetPassword }: UserRowProps) {
  const lockedDate = user.locked_until
    ? new Date(user.locked_until.endsWith('Z') ? user.locked_until : `${user.locked_until}Z`)
    : null
  const isLocked = lockedDate ? lockedDate > new Date() : false

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-violet-100 text-violet-900 border border-violet-200 dark:bg-violet-900/50 dark:text-violet-200 dark:border-violet-700'
      case 'user':
        return 'bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700'
      default:
        return 'bg-muted text-muted-foreground border border-border'
    }
  }

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
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${roleBadge(user.role)}`}
        >
          {user.role}
        </span>
      </td>

      {/* Active status */}
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            user.is_active
              ? 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800'
              : 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-800'
          }`}
        >
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
        <div className="flex items-center justify-end gap-1.5 transition-opacity">
          <button
            onClick={() => onEdit(user)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Chỉnh sửa"
          >
            <Edit className="w-4 h-4" />
          </button>

          {isLocked ? (
            <button
              onClick={() => onUnlock(user)}
              className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
              title="Mở khoá"
            >
              <Unlock className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onLock(user)}
              className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg transition-colors"
              title="Khoá tài khoản"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onResetPassword(user)}
            className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
            title="Đặt lại mật khẩu"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
