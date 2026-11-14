import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import {
  EyeIcon,
  EyeOffIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  Building2Icon,
  StaffIcon,
  PrinterIcon,
  TrendingUpIcon,
  PackageIcon,
  CheckCircle2Icon
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
        const { error: err } = await supabase.from('groups').select('id').limit(1);
        if (err && err.message?.includes('Fetch')) setIsApiReachable(false);
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
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (loginError) throw loginError;
        toast.success('Welcome back!');
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
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
        if (signUpError) throw signUpError;
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
    <div className="auth-viewport-wrapper">
      <div className="auth-split-grid">
        {/* Left Side: Brand Showcase (Shown on desktop & tablet landscape) */}
        <div className="auth-showcase-panel">
          <div className="auth-showcase-glow" />

          <div className="auth-showcase-content">
            <div className="auth-brand-badge-row">
              <div className="brand-logo-badge" style={{ width: '44px', height: '44px', fontSize: '18px' }}>
                SB
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  SimpleBill <span style={{ color: 'var(--accent-amber)' }}>Pro</span>
                </h2>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                  High-Speed Retail Billing & Cloud POS
                </span>
              </div>
            </div>

            <div style={{ margin: '36px 0 28px 0' }}>
              <h1 className="auth-hero-headline">
                Lightning POS & live inventory designed for modern stores.
              </h1>
              <p className="auth-hero-desc">
                Process walk-in transactions in seconds, print wireless thermal slips, and track revenue across every store branch.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="auth-features-list">
              <div className="auth-feature-pill">
                <div className="feature-icon-box">
                  <PrinterIcon size={18} />
                </div>
                <div>
                  <strong>Wireless Bluetooth ESC/POS</strong>
                  <span>Supports 58mm & 80mm thermal receipt printers</span>
                </div>
              </div>

              <div className="auth-feature-pill">
                <div className="feature-icon-box">
                  <TrendingUpIcon size={18} />
                </div>
                <div>
                  <strong>Real-Time Sales & Profit Audit</strong>
                  <span>Instant breakdown of cash vs UPI and net profits</span>
                </div>
              </div>

              <div className="auth-feature-pill">
                <div className="feature-icon-box">
                  <PackageIcon size={18} />
                </div>
                <div>
                  <strong>Multi-Branch Live Stock</strong>
                  <span>Auto stock deduction on checkout & low stock warnings</span>
                </div>
              </div>
            </div>

            {/* Mock live metric badge */}
            <div className="auth-live-badge">
              <span className="status-dot online" />
              <span>Offline-first billing &bull; Multi-branch ready &bull; Zero bloat</span>
            </div>
          </div>
        </div>

        {/* Right Side: Responsive Authentication Form */}
        <div className="auth-form-panel">
          <div className="auth-card-container page-transition">
            {/* Mobile Header (Shown on screens < 1024px) */}
            <div className="auth-mobile-header">
              <div className="brand-logo-badge" style={{ width: '42px', height: '42px', fontSize: '17px', margin: '0 auto 10px' }}>
                SB
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 800 }}>
                SimpleBill <span style={{ color: 'var(--primary)' }}>Pro</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                {isLogin ? 'Sign in to access your point of sale' : 'Set up your store account'}
              </p>
            </div>

            {/* Desktop form title */}
            <div className="auth-desktop-header">
              <h2 style={{ fontSize: '26px', fontWeight: 800 }}>
                {isLogin ? 'Welcome back' : 'Create an account'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '4px' }}>
                {isLogin ? 'Enter your credentials to access the register' : 'Set up your store management profile'}
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
                  placeholder="name@store.com"
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
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '13.5px' }}
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
