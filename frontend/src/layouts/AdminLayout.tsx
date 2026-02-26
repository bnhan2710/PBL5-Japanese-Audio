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
    <aside className="w-[240px] min-h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-6 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
          <Headphones className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-foreground text-lg tracking-tight">Japanese Audio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-6 px-4 space-y-1.5">
        {navLinks.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-5 border-t border-border flex items-center gap-3 bg-muted/20">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold shrink-0 overflow-hidden border border-border">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            (user?.first_name?.[0] || user?.username?.[0] || user?.email?.[0] || 'A').toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {displayName}
          </p>
          <p className="text-[11px] text-muted-foreground truncate font-medium">{user?.email}</p>
        </div>
      </div>
    </aside>
  )
}

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50/30 dark:bg-transparent">
        <div className="max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
      
      {/* Floating help/settings button */}
      <button className="fixed bottom-6 right-6 w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all z-50">
        <Settings2 className="w-5 h-5" />
      </button>
    </div>
  )
}



