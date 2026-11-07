import React, { useEffect, useState } from 'react';
import { apiFetch, AuthUser } from '../../utils/auth.js';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onShowToast: (message: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast
}) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'reviewer' | 'approver' | 'admin'>('reviewer');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AuthUser[] | { error?: string }>('/api/users');
      if (res.ok && Array.isArray(res.data)) {
        setUsers(res.data);
      } else {
        const errObj = res.data as { error?: string } | null;
        setError(errObj?.error || 'Could not load users list');
      }
    } catch {
      setError('Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole
        })
      });

      if (!res.ok) {
        throw new Error(res.data?.error || 'Failed to create user');
      }

      onShowToast(`Created account for ${newUsername} (${newRole})`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('reviewer');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleDisabled = async (user: AuthUser) => {
    const nextDisabled = !user.disabled;
    if (user.id === currentUser.id) {
      setError('You cannot disable your own administrator account');
      return;
    }

    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: nextDisabled })
      });

      if (!res.ok) {
        throw new Error(res.data?.error || 'Failed to update user');
      }

      onShowToast(`User ${user.username} is now ${nextDisabled ? 'disabled' : 'active'}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
    }
  };

  const handleChangeRole = async (user: AuthUser, newRoleValue: string) => {
    if (user.id === currentUser.id && newRoleValue !== 'admin') {
      setError('You cannot remove your own administrator role');
      return;
    }

    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRoleValue })
      });

      if (!res.ok) {
        throw new Error(res.data?.error || 'Failed to update user role');
      }

      onShowToast(`Updated role for ${user.username} to ${newRoleValue}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error changing role');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">User Management & Permissions</h3>
              <p className="text-xs text-on-surface-variant">
                Provision workspace accounts, assign compliance roles, and manage access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-on-surface-variant">
              {users.length} registered workspace user{users.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showCreateForm ? 'close' : 'person_add'}
              </span>
              <span>{showCreateForm ? 'Cancel' : 'Add New User'}</span>
            </button>
          </div>

          {/* New User Creation Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                Create Workspace Account
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. sarah.approver"
                    className="w-full rounded-lg border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sarah@company.com"
                    className="w-full rounded-lg border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full rounded-lg border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-xs text-on-surface outline-none focus:border-secondary font-sans"
                  >
                    <option value="reviewer">Reviewer (Audits, copy fixes, OCR)</option>
                    <option value="approver">Approver (Review sign-off, export)</option>
                    <option value="admin">Admin (Full access + user admin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-semibold hover:bg-secondary-dim transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  <span>Save User Account</span>
                </button>
              </div>
            </form>
          )}

          {/* Users Table / List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              Loading users…
            </div>
          ) : (
            <div className="border border-surface-container-high rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low border-b border-surface-container-high text-on-surface-variant font-mono text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high bg-surface-container-lowest">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isDisabled = Boolean(u.disabled);

                    return (
                      <tr key={u.id} className={isDisabled ? 'opacity-60 bg-surface-container-low/50' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-on-surface flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono text-[9px] uppercase font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-on-surface-variant font-mono truncate max-w-[180px]">
                            {u.email || 'No email'}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <select
                            disabled={isSelf}
                            value={u.role}
                            onChange={(e) => handleChangeRole(u, e.target.value)}
                            aria-label={`Role for ${u.username}`}
                            className="bg-surface-container-low px-2 py-1 rounded border border-surface-container-high text-[11px] font-semibold capitalize text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="reviewer">Reviewer</option>
                            <option value="approver">Approver</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              isDisabled
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-secondary-container text-on-secondary-container'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isDisabled ? 'bg-error' : 'bg-secondary'}`} />
                            {isDisabled ? 'Disabled' : 'Active'}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleDisabled(u)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                isDisabled
                                  ? 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                                  : 'bg-error-container text-on-error-container hover:bg-error-container/80'
                              }`}
                            >
                              {isDisabled ? 'Enable' : 'Disable'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Role Permissions Reference */}
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-[11px] space-y-1.5 text-on-surface-variant">
            <span className="font-bold text-on-surface">Role Permissions:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-sans">
              <div className="p-2 rounded bg-surface-container-lowest border border-surface-container-high space-y-0.5">
                <strong className="text-secondary font-mono">Reviewer:</strong>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Upload campaigns, audit copy against rules, resolve suggestions, and edit artwork text.
                </p>
              </div>
              <div className="p-2 rounded bg-surface-container-lowest border border-surface-container-high space-y-0.5">
                <strong className="text-primary font-mono">Approver:</strong>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  All Reviewer rights + sign-off and file authorized review packs to audit ledger.
                </p>
              </div>
              <div className="p-2 rounded bg-surface-container-lowest border border-surface-container-high space-y-0.5">
                <strong className="text-on-surface font-mono">Admin:</strong>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Full access: manage accounts & roles, delete rules, system settings, plus review approval.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-surface-container-low border-t border-surface-container-high flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
