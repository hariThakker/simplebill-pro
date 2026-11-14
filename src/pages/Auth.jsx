import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import {
  EyeIcon,
  EyeOffIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  RefreshCwIcon,
  Building2Icon,
  StaffIcon
} from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';

export default function Auth() {
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('owner');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [isApiReachable, setIsApiReachable] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Check connectivity on mount
  useEffect(() => {
    const checkConn = async () => {
      try {
        const { error } = await supabase.from('groups').select('id').limit(1);
        if (error && error.message?.includes('Fetch')) setIsApiReachable(false);
      } catch {
        setIsApiReachable(false);
      }
    };
    checkConn();
  }, []);

  // Auto-clear error after 10 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebugInfo('');

    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Request timed out. Please check your internet connection.');
        setDebugInfo('The server took too long to respond.');
      }
    }, 15000);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
        toast.success('Welcome back!');
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              role: role
            }
          }
        });
        if (error) throw error;
        toast.success('Account created! Please log in to proceed.');
        setIsLogin(true);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred');

      if (err.message?.includes('Fetch')) {
        setDebugInfo('Network issue: Please check your internet or firewall settings.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setDebugInfo('Please verify your email address and password.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleConfirmReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'radial-gradient(ellipse at top, var(--card-subtle) 0%, var(--bg) 80%)'
      }}
    >
      <div
        className="card page-transition"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px 32px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-floating)'
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: 'var(--gradient-sunset)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '20px',
              margin: '0 auto 12px',
              boxShadow: 'var(--gradient-sunset-glow)'
            }}
          >
            SB
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>
            SimpleBill <span style={{ background: 'var(--gradient-sunset)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Pro</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '4px' }}>
            {isLogin ? 'Sign in to access your point of sale' : 'Set up your store account'}
          </p>
        </div>

        {/* Network Reachability Warning */}
        {!isApiReachable && (
          <div
            style={{
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <AlertTriangleIcon size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ color: 'var(--danger)', fontSize: '12.5px', fontWeight: 700 }}>
                Server Connection Issue
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                Unable to contact database. Please check your internet connection or proxy settings.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input
                  required
                  type="text"
                  className="input-v2"
                  placeholder="e.g. Maya Iyer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Account Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('owner')}
                    className={`btn ${role === 'owner' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '10px 8px' }}
                  >
                    <Building2Icon size={14} />
                    <span>Store Owner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('staff')}
                    className={`btn ${role === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '12px', padding: '10px 8px' }}
                  >
                    <StaffIcon size={14} />
                    <span>Staff Cashier</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <input
              required
              type="email"
              className="input-v2"
              placeholder="owner@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password with Visibility Toggle */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div className="form-control-wrapper">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                className="input-v2"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          {/* Inline Form Error */}
          {error && (
            <div className="form-error-banner" style={{ margin: '4px 0 0 0' }}>
              <AlertTriangleIcon size={16} />
              <div>
                <div>{error}</div>
                {debugInfo && <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{debugInfo}</div>}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '6px' }}
          >
            {loading ? 'Authenticating...' : isLogin ? 'Sign In to Dashboard' : 'Create Store Account'}
          </button>
        </form>

        {/* Toggle between Sign in & Sign up */}
        <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontWeight: 500, cursor: 'pointer', fontSize: '11.5px', textDecoration: 'underline' }}
          >
            Stuck or seeing cache issues? Clear session & reset
          </button>
        </div>

        {/* Device Clock Tip */}
        <div style={{ marginTop: '24px', padding: '12px 14px', background: 'var(--card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <ShieldCheckIcon size={15} style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <strong>Security Notice:</strong> Ensure your device Date & Time are set to "Set Automatically" to avoid token expiry.
          </p>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Session */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Local Session?"
        message="This will clear all locally cached credentials, active branch state, and printer preferences, then reload the page."
        confirmText="Yes, Reset Local Session"
        cancelText="Cancel"
        isDestructive={false}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
