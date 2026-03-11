/**
 * Users management page (admin only)
 */
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { userApi } from '../api';
import { User, UserCreate, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './Users.css';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<UserCreate>({
    email: '',
    full_name: '',
    role: UserRole.USER,
    password: '',
  });

  const [editFormData, setEditFormData] = useState({
    email: '',
    full_name: '',
    role: UserRole.USER,
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userApi.list();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await userApi.create(formData);
      setSuccess('User created successfully');
      setFormData({
        email: '',
        full_name: '',
        role: UserRole.USER,
        password: '',
      });
      setShowForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleActivate = async (userId: number) => {
    try {
      await userApi.activate(userId);
      setSuccess('User activated');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to activate user');
    }
  };

  const handleDeactivate = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      await userApi.deactivate(userId);
      setSuccess('User deactivated');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate user');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;

    try {
      await userApi.delete(userId);
      setSuccess('User deleted');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    setSuccess('');

    try {
      await userApi.update(editingUser.id, editFormData);
      setSuccess('User updated successfully');
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="loading">Loading users...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="users-page">
        <div className="page-header">
          <h1>User Management</h1>
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary-inline">
              {showForm ? 'Cancel' : '+ New User'}
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {showForm && isAdmin && (
          <div className="user-form-card">
            <h2>Create New User</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="full_name">Full Name *</label>
                <input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <small>User will be required to change password on first login</small>
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <option value={UserRole.USER}>Regular User</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
              </div>

              <button type="submit" className="btn-primary-inline">
                Create User
              </button>
            </form>
          </div>
        )}

        {editingUser && (
          <div className="user-form-card">
            <h2>Edit User</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label htmlFor="edit_email">Email *</label>
                <input
                  id="edit_email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit_full_name">Full Name *</label>
                <input
                  id="edit_full_name"
                  type="text"
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  required
                />
              </div>

              {isAdmin && (
                <div className="form-group">
                  <label htmlFor="edit_role">Role *</label>
                  <select
                    id="edit_role"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                  >
                    <option value={UserRole.USER}>Regular User</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary-inline">
                  Save Changes
                </button>
                <button type="button" onClick={handleCancelEdit} className="btn-secondary-inline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isCurrentUser = user.id === currentUser?.id;
                const canEdit = isAdmin || isCurrentUser;
                const canModify = isAdmin && !isCurrentUser;

                return (
                <tr key={user.id} className={!user.is_active ? 'inactive-row' : ''}>
                  <td>
                    <div className="user-email">{user.email}</div>
                    {user.must_change_password && (
                      <span className="badge-small warning">Password change required</span>
                    )}
                  </td>
                  <td>{user.full_name}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>{user.role}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      {canEdit && (
                        <button
                          onClick={() => handleEditClick(user)}
                          className="btn-link-small"
                          title="Edit user"
                        >
                          Edit
                        </button>
                      )}
                      {canModify && (
                        <>
                          {user.is_active ? (
                            <button
                              onClick={() => handleDeactivate(user.id)}
                              className="btn-link-small btn-muted-link"
                              title="Deactivate user"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(user.id)}
                              className="btn-link-small btn-success-link"
                              title="Activate user"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="btn-link-small btn-danger-link"
                            title="Delete user permanently"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};
