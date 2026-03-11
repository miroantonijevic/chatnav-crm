/**
 * Main layout component
 */
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import './MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="main-layout">
      <nav className="navbar">
        <div className="nav-brand">
          <Link to="/dashboard">CRM</Link>
        </div>
        <div className="nav-links">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/contacts">Contacts</NavLink>
          {user?.role === UserRole.ADMIN && (
            <>
              <NavLink to="/users">Users</NavLink>
              <NavLink to="/reminders">Reminders</NavLink>
            </>
          )}
        </div>
        <div className="nav-user">
          <span className="user-name">{user?.full_name}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};
