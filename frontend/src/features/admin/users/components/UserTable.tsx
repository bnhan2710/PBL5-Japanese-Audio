import { UserRow } from './UserRow';
import type { User } from '../types/user';

interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onLock: (user: User) => void;
  onUnlock: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export function UserTable({ users, loading, onEdit, onLock, onUnlock, onResetPassword }: UserTableProps) {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Không tìm thấy người dùng nào.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/40 border-b border-border">
          <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Người dùng
          </th>
          <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Vai trò
          </th>
          <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Trạng thái
          </th>
          <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Khoá tài khoản
          </th>
          <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ngày tạo
          </th>
          <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Thao tác
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            onEdit={onEdit}
            onLock={onLock}
            onUnlock={onUnlock}
            onResetPassword={onResetPassword}
          />
        ))}
      </tbody>
    </table>
  );
}
