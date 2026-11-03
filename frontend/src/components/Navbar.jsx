import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { GitGraph, LogOut, LayoutDashboard, Settings, Bell, BarChart2 } from 'lucide-react';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, children, icon: Icon }) => (
    <Link
      to={to}
      className="flex items-center gap-1.5 text-sm transition-colors duration-150"
      style={{
        color: isActive(to)
          ? 'var(--color-ink)'
          : 'var(--color-ink-3)',
      }}
      onMouseEnter={e => { if (!isActive(to)) e.currentTarget.style.color = 'var(--color-ink-2)'; }}
      onMouseLeave={e => { if (!isActive(to)) e.currentTarget.style.color = 'var(--color-ink-3)'; }}
    >
      {Icon && <Icon size={14} strokeWidth={1.75} />}
      <span>{children}</span>
    </Link>
  );

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backgroundColor: 'color-mix(in oklch, var(--color-base) 92%, transparent)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        height: '48px',
      }}
    >
      {/* Wordmark */}
      <Link
        to={isAuthenticated ? '/dashboard' : '/'}
        style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}
      >
        <GitGraph
          size={18}
          strokeWidth={1.75}
          style={{ color: 'var(--color-accent)' }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontSize: '0.9375rem',
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
          }}
        >
          mímir
        </span>
      </Link>

      {/* Nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {isAuthenticated ? (
          <>
            <NavLink to="/dashboard" icon={LayoutDashboard}>dashboard</NavLink>
            <NavLink to="/analytics" icon={BarChart2}>analytics</NavLink>

            {/* Divider */}
            <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)' }} />

            {/* Bell */}
            <Link
              to="/notifications"
              title="Notifications"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-ink-3)',
                transition: 'color 150ms ease-out',
                padding: '4px',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-3)'}
            >
              <Bell size={15} strokeWidth={1.75} />
            </Link>

            {/* Settings */}
            <Link
              to="/settings"
              title="Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-ink-3)',
                transition: 'color 150ms ease-out',
                padding: '4px',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-3)'}
            >
              <Settings size={15} strokeWidth={1.75} />
            </Link>

            {/* Divider */}
            <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border)' }} />

            {/* User */}
            <Link
              to={`/profile/${user?.username}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                color: 'var(--color-ink-2)',
                transition: 'color 150ms ease-out',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-2)'}
            >
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.username}&background=121212&color=fff&size=64`}
                alt={user?.username}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '1px solid var(--color-border)',
                  objectFit: 'cover',
                }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 500 }}>
                {user?.username}
              </span>
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-ink-4)',
                padding: '4px',
                transition: 'color 150ms ease-out',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-4)'}
            >
              <LogOut size={14} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--color-ink-2)',
                transition: 'color 150ms ease-out',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-2)'}
            >
              sign in
            </Link>
            <Link
              to="/register"
              className="btn-primary"
              style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
            >
              get started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
