import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { UserTable } from './components/UserTable';
import { UserFilters } from './components/UserFilters';
import { Pagination } from './components/Pagination';
import { CreateUserModal } from './components/CreateUserModal';
import { EditUserModal } from './components/EditUserModal';
import { LockUserDialog } from './components/LockUserDialog';
import { ResetPasswordDialog } from './components/ResetPasswordDialog';
import { Toast } from '../../../components/Toast';
import { useUsers } from './hooks/useUsers';
import { adminApi } from '../api/adminClient';
import type { User } from './types/user';

export function UsersPage() {
  // Filters & Pagination
  const [searchValue, setSearchValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch users
  const { data, loading, error, refetch } = useUsers({
    email: searchValue || undefined,
    username: searchValue || undefined,
    role: roleFilter || undefined,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
    page: currentPage,
    page_size: pageSize,
  });

  // Handlers
  const handleCreateUser = async (userData: any) => {
    try {
      await adminApi.createUser(userData);
      setShowCreateModal(false);
      setToast({ message: 'User created successfully', type: 'success' });
      refetch();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to create user', type: 'error' });
    }
  };

  const handleEditUser = async (userId: number, userData: any) => {
    try {
      await adminApi.updateUser(userId, userData);
      setShowEditModal(false);
      setSelectedUser(null);
      setToast({ message: 'User updated successfully', type: 'success' });
      refetch();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to update user', type: 'error' });
    }
  };

  const handleLockUser = async (userId: number, durationHours: number) => {
    try {
      await adminApi.lockUser(userId, durationHours);
      setToast({ message: 'User account locked', type: 'success' });
      refetch();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to lock user', type: 'error' });
    }
  };

  const handleUnlockUser = async (user: User) => {
    try {
      await adminApi.unlockUser(user.id);
      setToast({ message: 'User account unlocked', type: 'success' });
      refetch();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to unlock user', type: 'error' });
    }
  };

  const handleResetPassword = async (user: User) => {
    try {
      const response: any = await adminApi.resetPassword(user.id);
      setTempPassword(response.temporary_password);
      setSelectedUser(user);
      setShowResetDialog(true);
      setToast({ message: 'Password reset successfully', type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to reset password', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Fira Code, monospace' }}>
              User Management
            </h1>
            <p className="text-slate-600">Manage users, roles, and permissions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors cursor-pointer shadow-md"
          >
            <UserPlus className="w-5 h-5" />
            Create User
          </button>
        </div>

        {/* Filters */}
        <UserFilters
          searchValue={searchValue}
          roleValue={roleFilter}
          statusValue={statusFilter}
          onSearchChange={setSearchValue}
          onRoleChange={setRoleFilter}
          onStatusChange={setStatusFilter}
        />

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Table */}
        <UserTable
          users={data?.users || []}
          loading={loading}
          onEdit={(user) => {
            setSelectedUser(user);
            setShowEditModal(true);
          }}
          onLock={(user) => {
            setSelectedUser(user);
            setShowLockDialog(true);
          }}
          onUnlock={handleUnlockUser}
          onResetPassword={handleResetPassword}
        />

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={data.total_pages}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Modals */}
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />

        <EditUserModal
          isOpen={showEditModal}
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleEditUser}
        />

        <LockUserDialog
          isOpen={showLockDialog}
          user={selectedUser}
          onClose={() => {
            setShowLockDialog(false);
            setSelectedUser(null);
          }}
          onConfirm={handleLockUser}
        />

        <ResetPasswordDialog
          isOpen={showResetDialog}
          tempPassword={tempPassword}
          userEmail={selectedUser?.email || null}
          onClose={() => {
            setShowResetDialog(false);
            setTempPassword(null);
            setSelectedUser(null);
          }}
        />

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}

export default UsersPage;
