import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppProvider } from '../context/AppContext'
import { Notification } from '../components/ui/Notification'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'

const publicNavLinks = [
  { to: '/', label: 'Home' },
] as const

const privateNavLinks = [{ to: '/dashboard', label: 'Dashboard' }] as const

function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { isAuthenticated, logout } = useAuth()
  const linkBase =
    'text-foreground hover:text-primary px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-accent/10'
  const activeLink = 'text-primary bg-accent/20 font-semibold'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
                privateNavLinks.map(({ to }) => (
                  <Link
                    key={to}
                    to={to}
                    className={location.pathname === to ? `${linkBase} ${activeLink}` : linkBase}
                  >
                    {t('nav.dashboard')}
                  </Link>
                ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <LanguageSwitcher />
            <ThemeToggle />
            {isAuthenticated ? (
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-foreground hover:text-primary"
              >
                {t('nav.logout')}
              </Button>
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

  return (
    <AppProvider>
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
      </div>
    </AppProvider>
  )
}
