import { X, Lock } from 'lucide-react'
import { useState } from 'react'
import type { User } from '../types/user'

interface LockUserDialogProps {
  isOpen: boolean
  user: User | null
  onClose: () => void
  onConfirm: (
    userId: number,
    durationHours: number,
    reason: string,
    detailedReason?: string
  ) => void
}

export function LockUserDialog({ isOpen, user, onClose, onConfirm }: LockUserDialogProps) {
  const [duration, setDuration] = useState<number>(24)
  const [reason, setReason] = useState<string>('Vi phạm chính sách bảo mật / Hoạt động bất thường')
  const [detailedReason, setDetailedReason] = useState<string>('')

  if (!isOpen || !user) return null

  const handleConfirm = () => {
    onConfirm(user.id, duration, reason, detailedReason)
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
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Khoá tài khoản</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Khoá tài khoản <strong className="text-foreground">{user.email}</strong>? Người dùng sẽ
          không thể đăng nhập cho đến khi khoá hết hạn.
        </p>

        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Phân loại vi phạm (Lý do)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-all"
            >
              <option value="Vi phạm chính sách bảo mật / Hoạt động bất thường">
                Vi phạm chính sách bảo mật / Hoạt động bất thường
              </option>
              <option value="Spam hoặc Lạm dụng hệ thống">Spam hoặc Lạm dụng hệ thống</option>
              <option value="Ngôn từ kích động hoặc Xúc phạm cá nhân">
                Ngôn từ kích động hoặc Xúc phạm cá nhân
              </option>
              <option value="Vi phạm bản quyền tài liệu">Vi phạm bản quyền tài liệu</option>
              <option value="Sử dụng phần mềm thứ ba trái phép">
                Sử dụng phần mềm thứ ba trái phép
              </option>
              <option value="Yêu cầu từ Chủ sở hữu tài khoản / Tạm khóa bảo vệ">
                Yêu cầu từ Chủ sở hữu tài khoản / Tạm khóa bảo vệ
              </option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Mô tả chi tiết (Tùy chọn)
            </label>
            <textarea
              value={detailedReason}
              onChange={(e) => setDetailedReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none h-20"
              placeholder="Ghi chú thêm thông tin hoặc bằng chứng vi phạm..."
            />
          </div>
          <div>
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
              <option value={-1}>Khóa vĩnh viễn</option>
            </select>
          </div>
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
  )
}
