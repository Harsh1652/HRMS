import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth/useAuth';
import { fetchDashboardStats } from './api/dashboard';
import { RoleBadge } from './components/Badge';
import { Monogram } from './components/Monogram';

/**
 * Application shell: a rail on wide screens, a top bar with a Menu on phones.
 * Navigation is role-aware — an EMPLOYEE never sees the register — but the API
 * enforces the same rules regardless of what is rendered here.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Same query key as the dashboard, so this costs nothing extra once that page has loaded.
  const stats = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats, enabled: !!user });

  if (!user) return null;

  const canSeeDirectory = user.role === 'ADMIN' || user.role === 'MANAGER';
  const [firstName, ...rest] = user.name.split(' ');
  const lastName = rest.join(' ') || firstName;

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between border-l-2 py-2 pl-4 pr-3 text-[14px] transition-colors ${
      isActive ? 'border-accent bg-surface font-semibold text-ink' : 'border-transparent text-ink-muted hover:bg-surface/60 hover:text-ink'
    }`;

  const close = () => setMenuOpen(false);

  const nav = (
    <nav className="py-2" aria-label="Main">
      <p className="eyebrow px-4 pb-1.5 pt-2">Overview</p>
      <NavLink to="/" end className={linkClass} onClick={close}>Dashboard</NavLink>
      {canSeeDirectory && (
        <>
          <p className="eyebrow px-4 pb-1.5 pt-4">People</p>
          <NavLink to="/employees" className={linkClass} onClick={close}>
            <span>{user.role === 'ADMIN' ? 'Register' : 'My team'}</span>
            {stats.data && <span className="num text-[12px] text-ink-faint">{stats.data.total}</span>}
          </NavLink>
          {user.role === 'ADMIN' && (
            <NavLink to="/employees/new" className={linkClass} onClick={close}>Add employee</NavLink>
          )}
        </>
      )}
      <p className="eyebrow px-4 pb-1.5 pt-4">You</p>
      <NavLink to="/me" className={linkClass} onClick={close}>My profile</NavLink>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-rule bg-surface-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:border-b lg:border-rule">
          <div>
            <p className="font-display text-[22px] font-semibold leading-none tracking-tight">HRMS</p>
            <p className="eyebrow mt-1">Staff register</p>
          </div>
          <button
            type="button"
            className="rounded border border-rule-strong bg-surface px-2.5 py-1 text-[13px] lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>

        <div id="mobile-nav" className={`${menuOpen ? 'block' : 'hidden'} border-t border-rule lg:flex lg:flex-1 lg:flex-col lg:border-t-0`}>
          <div className="lg:flex-1">{nav}</div>

          {canSeeDirectory && stats.data && (
            <div className="mx-4 mb-4 border border-rule bg-surface px-3 py-2.5">
              <p className="eyebrow">At a glance</p>
              <div className="mt-1.5 flex items-baseline gap-4">
                <span><span className="num font-display text-[22px] font-medium">{stats.data.active}</span> <span className="text-[12px] text-ink-muted">active</span></span>
                <span><span className="num font-display text-[22px] font-medium">{stats.data.byDepartment.length}</span> <span className="text-[12px] text-ink-muted">depts</span></span>
              </div>
            </div>
          )}

          <div className="border-t border-rule px-4 py-4">
            <div className="flex items-center gap-3">
              <Monogram firstName={firstName ?? '?'} lastName={lastName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[12px] text-ink-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <RoleBadge role={user.role} />
              <button type="button" onClick={handleLogout} disabled={signingOut} className="text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
