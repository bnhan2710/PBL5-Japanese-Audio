import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Notification } from '../components/ui/Notification'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { UserMenu } from '../components/ui/UserMenu'
import { Toaster } from '../components/ui/toaster'
import { toast } from '../hooks/use-toast'
import { AIChatWidget } from '../components/AIChatWidget'

const publicNavLinks = [{ to: '/', label: 'Home' }] as const

const privateNavLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/arena', label: 'JLPT Ranking Arena' },
] as const

function Navigation() {
  const location = useLocation()
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const linkBase =
    'text-foreground hover:text-primary px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-accent/10'
  const activeLink = 'text-primary bg-accent/20 font-semibold'

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-primary-foreground font-bold text-lg">日</span>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Japanese Audio
              </span>
            </Link>

            <div className="flex space-x-2">
              {publicNavLinks.map(({ to }) => (
                <Link
                  key={to}
                  to={to}
                  className={location.pathname === to ? `${linkBase} ${activeLink}` : linkBase}
                >
                  {t('nav.home')}
                </Link>
              ))}
              {isAuthenticated &&
                privateNavLinks.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={
                      location.pathname === to || location.pathname.startsWith(`${to}/`)
                        ? `${linkBase} ${activeLink}`
                        : linkBase
                    }
                  >
                    {to === '/dashboard' ? t('nav.dashboard') : label}
                  </Link>
                ))}
              {isAuthenticated && user?.role === 'admin' && (
                <Link
                  to="/admin/users"
                  className={
                    location.pathname === '/admin/users' ? `${linkBase} ${activeLink}` : linkBase
                  }
                >
                  {t('nav.users', 'Users')}
                </Link>
              )}
              {isAuthenticated && user?.role === 'admin' && (
                <Link
                  to="/admin/audio-library"
                  className={
                    location.pathname === '/admin/audio-library'
                      ? `${linkBase} ${activeLink}`
                      : linkBase
                  }
                >
                  {t('nav.audioLibrary', 'Audio Library')}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            <ThemeToggle />
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    className={location.pathname === '/login' ? 'text-primary' : ''}
                  >
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="shadow-md">
                    {t('nav.signUp')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout() {
  const currentYear = new Date().getFullYear()
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()

  // Show pending AI exam draft notification if user re-logged in
  useEffect(() => {
    const pending = localStorage.getItem('ai_exam_draft_saved')
    if (!pending) return
    try {
      const data = JSON.parse(pending) as { title: string; level: string; draftId: string; timestamp: number }
      if (Date.now() - data.timestamp < 7 * 24 * 60 * 60 * 1000) {
        toast({
          title: '🎉 Đề AI đã tạo xong!',
          description: `Đề "${data.title}" (${data.level}) đã được tự động lưu bản nháp. Vào quản lý đề thi để xem.`,
        })
      }
    } catch { /* ignore */ }
    localStorage.removeItem('ai_exam_draft_saved')
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
      <Navigation />
      <main className="flex-1 container mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="bg-card text-card-foreground shadow-sm transition-colors mt-auto border-t border-border">
        <div className="container mx-auto px-6 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © {currentYear} {t('footer.copyright')}
          </p>
        </div>
      </footer>
      <Notification />
      <Toaster />
      {isAuthenticated && <AIChatWidget />}
    </div>
  )
}
