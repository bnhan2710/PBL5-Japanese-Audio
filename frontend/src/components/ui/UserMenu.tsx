import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggleMenu}
        className="flex items-center space-x-2 focus:outline-none"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary transition-colors">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username || 'User'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-accent flex items-center justify-center text-accent-foreground">
              <UserIcon size={20} />
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg border border-border py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>

          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings size={16} className="mr-2" />
            Profile
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
