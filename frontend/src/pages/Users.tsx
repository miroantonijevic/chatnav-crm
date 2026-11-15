/**
 * Users management page (admin only)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { userApi } from '../api';
import { User, UserCreate, UserRole, UserUpdate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm, useToast } from '../contexts/UiContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { fmtDate, fromServer } from '../utils/dates';
import { Modal } from '../components/Modal';
import { PasswordInput } from '../components/AuthShell';
import { Alert, Avatar, EmptyState, RowMenu, SearchBox, TableSkeleton } from '../components/ui';
import '../styles/users.css';

interface FormState {
  email: string;
  full_name: string;
  role: UserRole;
  password: string;
  must_change_password: boolean;
}

const emptyForm: FormState = { email: '', full_name: '', role: UserRole.USER, password: '', must_change_password: false };

interface UserModalProps {
  user: User | null; // null = create
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, isAdmin, onClose, onSaved }) => {
  const editing = user !== null;
  const [form, setForm] = useState<FormState>(
    user ? { email: user.email, full_name: user.full_name, role: user.role, password: '', must_change_password: user.must_change_password } : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing && user) {
        const payload: UserUpdate = { email: form.email, full_name: form.full_name, role: form.role, must_change_password: form.must_change_password };
        if (form.password) {
          payload.new_password = form.password;
          // Non-admins changing their own password clear the force-change flag
          if (!isAdmin) payload.must_change_password = false;
        }
        await userApi.update(user.id, payload);
        onSaved('User updated');
      } else {
        const payload: UserCreate = { email: form.email, full_name: form.full_name, role: form.role, password: form.password };
        await userApi.create(payload);
        onSaved('User created');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit user' : 'New user'} onClose={onClose} locked={saving}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="field">
            <label htmlFor="u_name">Full name <span className="req">*</span></label>
            <input id="u_name" type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="u_email">Email <span className="req">*</span></label>
            <input id="u_email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>

          {isAdmin && (
            <div className="field">
              <label htmlFor="u_role">Role</label>
              <select id="u_role" value={form.role} onChange={(e) => set('role', e.target.value as UserRole)}>
                <option value={UserRole.USER}>Regular user – sees and manages contacts</option>
                <option value={UserRole.ADMIN}>Admin – also manages users and reminders</option>
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="u_pw">
              {editing ? 'New password' : 'Password'} {editing ? <span className="hint">(optional – leave blank to keep the current one)</span> : <span className="req">*</span>}
            </label>
            <PasswordInput id="u_pw" value={form.password} onChange={(v) => set('password', v)} required={!editing} minLength={6} autoComplete="new-password" />
            {!editing && <span className="hint">The user will have to change it on first login.</span>}
          </div>

          {editing && isAdmin && (
            <label className="check">
              <input type="checkbox" checked={form.must_change_password} onChange={(e) => set('must_change_password', e.target.checked)} />
              Require a password change on next login
            </label>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : editing ? 'Save changes' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const UsersPage: React.FC = () => {
  usePageTitle('Users');
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ user: User | null } | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const load = useCallback(async () => {
    try {
      setUsers(await userApi.list());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast(success);
      load();
    } catch (err: any) {
      toast(err.message || 'Something went wrong', 'error');
    }
  };

  const deactivate = async (u: User) => {
    const ok = await confirm({
      title: 'Deactivate user?',
      message: <>{u.full_name} will no longer be able to sign in. You can activate them again later.</>,
      confirmLabel: 'Deactivate',
      tone: 'warn',
    });
    if (ok) run(() => userApi.deactivate(u.id), `${u.full_name} deactivated`);
  };

  const remove = async (u: User) => {
    const ok = await confirm({
      title: 'Delete user permanently?',
      message: <>{u.full_name} and their data will be deleted. This cannot be undone.</>,
      confirmLabel: 'Delete user',
      tone: 'danger',
    });
    if (ok) run(() => userApi.delete(u.id), `${u.full_name} deleted`);
  };

  const admins = users.filter((u) => u.role === UserRole.ADMIN).length;
  const inactive = users.filter((u) => !u.is_active).length;

  return (
    <MainLayout>
      <div className="page page-narrow">
        <div className="page-header">
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-sub">
              {users.length} {users.length === 1 ? 'person' : 'people'} · {admins} admin{admins === 1 ? '' : 's'}
              {inactive > 0 && ` · ${inactive} inactive`}
            </p>
          </div>
          {isAdmin && (
            <div className="page-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setModal({ user: null })}>+ New user</button>
            </div>
          )}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="filters">
          <SearchBox value={query} onChange={setQuery} placeholder="Search by name or e-mail…" label="Search users" />
        </div>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState compact title="No users match">Try a different search.</EmptyState>
        ) : (
          <div className="card table-card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {visible.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const canEdit = isAdmin || isSelf;
                    const canModify = isAdmin && !isSelf;
                    return (
                      <tr key={u.id} className={u.is_active ? '' : 'is-inactive'}>
                        <td>
                          <div className="user-cell">
                            <Avatar name={u.full_name} size="lg" />
                            <div>
                              <div className="row-link" style={{ cursor: 'default' }}>
                                {u.full_name} {isSelf && <span className="badge badge-brand">You</span>}
                              </div>
                              <div className="cell-sub">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge ${u.role === UserRole.ADMIN ? 'badge-brand' : ''}`}>{u.role === UserRole.ADMIN ? 'Admin' : 'User'}</span></td>
                        <td>
                          <div className="row">
                            <span className={`badge badge-dot ${u.is_active ? 'badge-ok' : ''}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                            {u.must_change_password && <span className="badge badge-warn" title="Has to change the password on next login">Password change pending</span>}
                          </div>
                        </td>
                        <td className="nowrap">{fmtDate(fromServer(u.created_at))}</td>
                        <td className="right">
                          <RowMenu
                            actions={[
                              { label: 'Edit', onClick: () => setModal({ user: u }), hidden: !canEdit },
                              { label: 'Deactivate', onClick: () => deactivate(u), hidden: !canModify || !u.is_active },
                              { label: 'Activate', onClick: () => run(() => userApi.activate(u.id), `${u.full_name} activated`), hidden: !canModify || u.is_active },
                              { label: 'Delete', onClick: () => remove(u), danger: true, hidden: !canModify },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal.user}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            toast(message);
            load();
          }}
        />
      )}
    </MainLayout>
  );
};
