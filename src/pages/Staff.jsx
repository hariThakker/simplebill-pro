import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  StaffIcon,
  PlusIcon,
  XIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  RefreshCwIcon
} from '../components/Icons';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';

// Secondary client to register staff without affecting current session
const authClient = createClient(
  'https://qblpecdpudamykvgqalx.supabase.co',
  'sb_publishable_tlMLvbA4DsJnIrXWVMVbqA_KuSKdjel',
  { auth: { persistSession: false } }
);

export default function Staff() {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff'
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    checkRole();
    fetchStaff();
  }, []);

  async function checkRole() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.role === 'owner') {
      setIsOwner(true);
    }
  }

  async function fetchStaff() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'staff')
      .eq('group_id', groupId);

    if (error) {
      console.error('Error fetching staff:', error);
    }

    if (data) setStaff(data);
    setLoading(false);
  }

  const validate = () => {
    const errors = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email address is required';
    if (!formData.password || formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!validate()) return;

    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) {
      toast.warning('Please select a branch first!');
      return;
    }

    setIsCreating(true);

    try {
      const { error } = await authClient.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim(),
            role: 'staff',
            group_id: groupId
          }
        }
      });

      if (error) throw error;

      toast.success(`Staff account created for ${formData.full_name.trim()}`);
      setShowAdd(false);
      setFormData({ email: '', password: '', full_name: '', role: 'staff' });
      setFormErrors({});

      setTimeout(fetchStaff, 1500);
    } catch (err) {
      toast.error('Failed to create staff account: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="card page-transition" style={{ textAlign: 'center', padding: '80px 20px', maxWidth: '500px', margin: '40px auto' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--danger-subtle)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <ShieldCheckIcon size={28} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Owner Access Only</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
          Staff management is reserved for Company Owners. Contact your store owner to adjust team roles.
        </p>
      </div>
    );
  }

  return (
    <div className="page-transition">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Staff & Team</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Manage cashier accounts and branch access permissions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={fetchStaff}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh team list"
          >
            <RefreshCwIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(true);
              setFormErrors({});
            }}
            className="btn btn-primary"
          >
            <PlusIcon size={16} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => !isCreating && setShowAdd(false)}>
          <div
            className="modal-container page-transition"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => !isCreating && setShowAdd(false)}
              disabled={isCreating}
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>

            <span className="floating-contact-badge">Store Team</span>
            <h3 style={{ fontSize: '19px', fontWeight: 800, marginTop: '4px', marginBottom: '4px' }}>
              Create Staff Account
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginBottom: '20px' }}>
              Staff can process POS sales and record daily logs.
            </p>

            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className={`input-v2 ${formErrors.full_name ? 'error' : ''}`}
                  placeholder="e.g. Rahul Sharma"
                  value={formData.full_name}
                  onChange={(e) => {
                    setFormData({ ...formData, full_name: e.target.value });
                    if (formErrors.full_name) setFormErrors({ ...formErrors, full_name: null });
                  }}
                />
                {formErrors.full_name && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.full_name}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className={`input-v2 ${formErrors.email ? 'error' : ''}`}
                  placeholder="staff@store.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: null });
                  }}
                />
                {formErrors.email && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.email}
                  </div>
                )}
              </div>

              {/* Password with Visibility Toggle */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Set Login Password</label>
                <div className="form-control-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`input-v2 ${formErrors.password ? 'error' : ''}`}
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (formErrors.password) setFormErrors({ ...formErrors, password: null });
                    }}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="input-icon-btn"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
                {formErrors.password && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.password}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  disabled={isCreating}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn btn-primary"
                >
                  {isCreating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Directory List */}
      {loading ? (
        <SkeletonList count={3} />
      ) : staff.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)' }}>
          <StaffIcon size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            No staff members in this branch
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
            Invite your store cashiers or attendants to give them POS access.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="btn btn-primary"
          >
            <PlusIcon size={16} />
            <span>Add First Staff Member</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {staff.map((member) => (
            <div
              key={member.id}
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '15px'
                  }}
                >
                  {member.full_name?.charAt(0)?.toUpperCase() || 'S'}
                </div>

                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                    {member.full_name || 'Staff Member'}
                  </h4>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {member.email || 'No email specified'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Cashier & POS
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
