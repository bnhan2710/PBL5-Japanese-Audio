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
      <div className="bg-card rounded-lg shadow-md border border-border">
        <div className="p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-md p-8 text-center border border-border">
        <p className="text-muted-foreground">No users found</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-md border border-border">
      <div className="overflow-x-visible">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lock Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
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
      </div>
    </div>
  );
}
