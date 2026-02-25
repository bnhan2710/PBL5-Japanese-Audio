import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  BarChart2,
  Settings,
  Headphones,
  Settings2,
  Users,
} from 'lucide-react'

function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const navLinks = [
    { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/create', label: 'Tạo đề mới', icon: PlusCircle },
    { to: '/question-bank', label: 'Ngân hàng câu hỏi', icon: BookOpen },
    ...(isAdmin ? [{ to: '/admin/users', label: 'Quản lý người dùng', icon: Users }] : []),
    { to: '/analytics', label: 'Phân tích học tập', icon: BarChart2 },
    { to: '/settings', label: 'Cài đặt', icon: Settings },
  ]

  const displayName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : user?.username || user?.email?.split('@')[0] || 'Người dùng'

  return (
    <aside className="w-[220px] min-h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
          <Headphones className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-foreground text-base tracking-tight">Japanese Audio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navLinks.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold shrink-0 overflow-hidden">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            (user?.first_name?.[0] || user?.username?.[0] || user?.email?.[0] || 'A').toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>
    </aside>
  )
}

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {/* Floating settings button */}
      <button className="fixed bottom-6 right-6 w-10 h-10 bg-foreground text-background rounded-full flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity">
        <Settings2 className="w-4 h-4" />
      </button>
    </div>
  )
}

