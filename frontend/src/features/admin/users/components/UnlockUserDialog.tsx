import { X, Unlock } from 'lucide-react'
import type { User } from '../types/user'

interface UnlockUserDialogProps {
  isOpen: boolean
  user: User | null
  onClose: () => void
  onConfirm: (user: User) => void
}

export function UnlockUserDialog({ isOpen, user, onClose, onConfirm }: UnlockUserDialogProps) {
  if (!isOpen || !user) return null

  const handleConfirm = () => {
    onConfirm(user)
    onClose()
  }

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
          <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Mở khoá tài khoản</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Bạn có chắc chắn muốn mở khoá tài khoản{' '}
          <strong className="text-foreground">{user.email}</strong>? Người dùng sẽ ngay lập tức được
          khôi phục toàn bộ quyền truy cập vào hệ thống.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors cursor-pointer"
          >
            Xác nhận mở khoá
          </button>
        </div>
      </div>
    </div>
  )
}
