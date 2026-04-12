import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  BookOpen,
  Plus,
  FileText,
  Sparkles,
  History,
  FileAudio,
  Shuffle,
} from 'lucide-react'

const ADMIN_SHORTCUTS = [
  {
    title: 'Quản lý người dùng',
    description: 'Quản lý tài khoản, vai trò và trạng thái người dùng',
    icon: Users,
    path: '/admin/users',
    color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Ngân hàng câu hỏi',
    description: 'Xem và quản lý toàn bộ câu hỏi luyện nghe',
    icon: BookOpen,
    path: '/question-bank',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'Tài nguyên nghe',
    description: 'Hiển thị toàn bộ file nghe và trạng thái xử lý AI',
    icon: FileAudio,
    path: '/admin/audio-library',
    color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  },
  {
    title: 'Tạo đề thi mới',
    description: 'Tạo đề thi nghe tiếng Nhật theo cấu trúc JLPT',
    icon: Plus,
    path: '/exam/create',
    color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',
  },
  {
    title: 'Sinh đề bằng AI',
    description: 'Tự động tạo đề nghe tiếng Nhật từ audio sử dụng AI',
    icon: Sparkles,
    path: '/exam/ai-create',
    color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  },
  {
    title: 'Sinh đề ngẫu nhiên',
    description: 'Tạo đề thi bằng cách random hoá các câu hỏi hiện có',
    icon: Shuffle,
    path: '/exam/random-create',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'Đề thi của tôi',
    description: 'Xem lại các đề thi đã tạo và xuất bản',
    icon: FileText,
    path: '/exam',
    color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  },

  {
    title: 'Bài thi đã làm',
    description: 'Xem kết quả và lịch sử làm bài thi của bạn',
    icon: History,
    path: '/history',
    color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  },
]

const USER_SHORTCUTS = [
  {
    title: 'Ngân hàng câu hỏi',
    description: 'Xem và luyện tập với các câu hỏi nghe',
    icon: BookOpen,
    path: '/question-bank',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'Tạo đề thi mới',
    description: 'Tạo đề thi nghe tiếng Nhật theo cấu trúc JLPT',
    icon: Plus,
    path: '/exam/create',
    color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400',
  },
  {
    title: 'Sinh đề bằng AI',
    description: 'Tự động tạo đề nghe tiếng Nhật từ audio sử dụng AI',
    icon: Sparkles,
    path: '/exam/ai-create',
    color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  },
  {
    title: 'Sinh đề ngẫu nhiên',
    description: 'Tạo đề thi bằng cách random hoá các câu hỏi hiện có',
    icon: Shuffle,
    path: '/exam/random-create',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'Đề thi của tôi',
    description: 'Xem lại các đề thi đã tạo và xuất bản',
    icon: FileText,
    path: '/exam',
    color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  },

  {
    title: 'Bài thi đã làm',
    description: 'Xem kết quả và lịch sử làm bài thi của bạn',
    icon: History,
    path: '/history',
    color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const shortcuts = isAdmin ? ADMIN_SHORTCUTS : USER_SHORTCUTS
  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : (user?.username ?? user?.email ?? 'bạn')

  return (
    <div className="p-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Xin chào, {displayName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? 'Bảng điều khiển dành cho quản trị viên'
            : 'Chào mừng bạn quay lại hệ thống Japanese Audio'}
        </p>
      </div>

      {/* Shortcuts grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shortcuts.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="group text-left p-5 bg-card rounded-xl border border-border hover:shadow-md hover:border-border/60 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg shrink-0 ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                  {item.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
