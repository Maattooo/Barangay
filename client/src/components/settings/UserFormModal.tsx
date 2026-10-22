import React, { useState, useEffect } from 'react';
import { X, UserPlus, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { UserAccount, CreateUserInput, UpdateUserInput } from '../../types/admin';
import { UserRole } from '../../types/auth';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserAccount | null; // null if adding new user
}

const ROLES: UserRole[] = ['Admin', 'Clerk', 'Treasurer', 'Lupon'];

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user
}) => {
  const isEditing = !!user;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('Clerk');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setPassword('');
      setFullName(user.full_name);
      setRole(user.role);
      setIsActive(Number(user.is_active) === 1);
    } else {
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('Clerk');
      setIsActive(true);
    }
    setError(null);
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEditing) {
      if (!username.trim()) {
        setError('Username is required.');
        return;
      }
      if (!password.trim()) {
        setError('Password is required.');
        return;
      }
    }

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && user) {
        const payload: UpdateUserInput = {
          full_name: fullName.trim(),
          role,
          is_active: isActive ? 1 : 0
        };
        if (password.trim().length > 0) {
          payload.password = password.trim();
        }
        await api.updateUser(user.id, payload);
      } else {
        const payload: CreateUserInput = {
          username: username.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          role
        };
        await api.createUser(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-md w-full border border-zinc-300 overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              {isEditing ? <KeyRound className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h2 id="user-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                {isEditing ? 'Edit User / Reset Password' : 'Add Staff User'}
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                {isEditing ? `Modifying account @${user?.username}` : 'Create workstation staff login'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-950 rounded-none transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs font-mono text-red-800 font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div className="space-y-1">
            <label htmlFor="staff_username" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="staff_username"
              name="staff_username"
              aria-label="Username"
              type="text"
              required={!isEditing}
              disabled={isEditing}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jdelacruz"
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors disabled:bg-zinc-100 disabled:text-zinc-500 font-mono"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label htmlFor="staff_fullname" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="staff_fullname"
              name="staff_fullname"
              aria-label="Full Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="staff_password" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              {isEditing ? 'New Password (leave blank to keep unchanged)' : 'Password'} {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              id="staff_password"
              name="staff_password"
              aria-label="Password"
              type="password"
              required={!isEditing}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? '••••••••' : 'Enter secure password'}
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors font-mono"
            />
          </div>

          {/* Role selector */}
          <div className="space-y-1">
            <label htmlFor="staff_role" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Staff Role <span className="text-red-500">*</span>
            </label>
            <select
              id="staff_role"
              name="staff_role"
              aria-label="Staff Role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} {r === 'Admin' ? '(Secretary / Full Access)' : r === 'Lupon' ? '(Peace & Order)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status (if editing) */}
          {isEditing && (
            <div className="flex items-center gap-2 pt-1 font-mono">
              <input
                id="staff_active"
                name="staff_active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-zinc-900 rounded-none border-zinc-300 focus:ring-0"
              />
              <label htmlFor="staff_active" className="text-xs text-zinc-800 select-none cursor-pointer">
                Active Account (enabled for workstation login)
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-zinc-900 hover:bg-black rounded-none transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Staff User'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
