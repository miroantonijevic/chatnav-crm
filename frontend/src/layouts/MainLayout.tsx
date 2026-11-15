/**
 * Main layout: sticky top bar with navigation and the user menu.
 */
import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Avatar } from '../components/ui';
import { Popover } from '../components/Popover';
import './MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer after navigating
  useEffect(() => setNavOpen(false), [location.pathname]);

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/dashboard" className="brand" aria-label="CRM home">
            <span className="brand-mark">C</span>
            <span className="brand-name">CRM</span>
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>

          <nav className={`nav${navOpen ? ' open' : ''}`} aria-label="Main">
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/pipeline">Pipeline</NavLink>
            <NavLink to="/contacts">Contacts</NavLink>
            <NavLink to="/companies">Companies</NavLink>
            {isAdmin && (
              <>
                <NavLink to="/users">Users</NavLink>
                <NavLink to="/reminders">Reminders</NavLink>
              </>
            )}
          </nav>

          <button
            type="button"
            className="user-button"
            aria-haspopup="menu"
            aria-expanded={menuAnchor !== null}
            onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
          >
            <Avatar name={user?.full_name ?? '?'} size="sm" />
            <span className="user-button-name">{user?.full_name}</span>
            <span className="user-button-caret" aria-hidden="true">▾</span>
          </button>

          {menuAnchor && (
            <Popover anchor={menuAnchor} onClose={() => setMenuAnchor(null)} className="menu" align="right">
              <div className="menu-head">
                <strong>{user?.full_name}</strong>
                <span>{user?.email}</span>
                <div style={{ marginTop: '0.35rem' }}>
                  <span className={`badge ${isAdmin ? 'badge-brand' : ''}`}>{isAdmin ? 'Admin' : 'User'}</span>
                </div>
              </div>
              <div className="menu-sep" />
              <Link to="/change-password" className="menu-item" onClick={() => setMenuAnchor(null)}>Change password</Link>
              <button type="button" className="menu-item menu-item-danger" onClick={handleLogout}>Log out</button>
            </Popover>
          )}
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
};
