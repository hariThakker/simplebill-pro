import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('owner'); // 'owner' or 'staff'
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [isApiReachable, setIsApiReachable] = useState(true);

  // Check connectivity on mount
  useEffect(() => {
    const checkConn = async () => {
      try {
        const { error } = await supabase.from('groups').select('id').limit(1);
        if (error && error.message?.includes('Fetch')) setIsApiReachable(false);
      } catch (e) {
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

    // Timeout mechanism to prevent "stuck on processing"
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Request timed out. Please check your internet connection and device clock.');
        setDebugInfo('The server took too long to respond. This can happen if your internet is slow, or if your device time/date is incorrect.');
      }
    }, 15000); // 15 seconds timeout

    try {
      if (isLogin) {
        console.log('Attempting login...');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log('Login successful:', data);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              role: role
            }
          }
        });
        if (error) throw error;
        alert('Signup successful! Please check your email for verification (if enabled) or just login.');
        setIsLogin(true);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred');
      
      // Check for common issues
      if (err.message?.includes('Fetch')) {
        setDebugInfo('Network error detected. Please check if your firewall or ad-blocker is blocking Supabase.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setDebugInfo('Please check your email and password.');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('This will clear all local data and refresh the page. Use this if you are stuck or seeing errors. Continue?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px',
      background: 'var(--bg)'
    }}>
      <div className="card" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px', 
        borderRadius: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px' }}>
            SimpleBill <span style={{ color: 'var(--accent)' }}>Pro</span>
          </h1>
          <p style={{ color: 'var(--text-dim)', fontWeight: 500 }}>
            {isLogin ? 'Welcome back! Please login.' : 'Create your account to start.'}
          </p>
        </div>

        {!isApiReachable && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid var(--danger)', 
            padding: '12px', 
            borderRadius: '12px', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 700 }}>
              ⚠️ Connection Issue Detected
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
              We can't reach the server. Please check your internet or firewall.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!isLogin && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Full Name</label>
                <input 
                  required
                  className="input-v2"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Account Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => setRole('owner')}
                    className="btn"
                    style={{ 
                      background: role === 'owner' ? 'var(--primary)' : 'var(--bg)',
                      color: role === 'owner' ? 'white' : 'var(--text-dim)',
                      fontSize: '13px',
                      padding: '10px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    🚀 Company Owner
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('staff')}
                    className="btn"
                    style={{ 
                      background: role === 'staff' ? 'var(--primary)' : 'var(--bg)',
                      color: role === 'staff' ? 'white' : 'var(--text-dim)',
                      fontSize: '13px',
                      padding: '10px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    🛠️ Staff Member
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Email Address</label>
            <input 
              required
              type="email"
              className="input-v2"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Password</label>
            <input 
              required
              type="password"
              className="input-v2"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600, textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>
                {error}
              </div>
              {debugInfo && (
                <div style={{ color: 'var(--text-dim)', fontSize: '11px', textAlign: 'center', fontStyle: 'italic' }}>
                  {debugInfo}
                </div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '16px', marginTop: '10px' }}
          >
            {loading ? 'Processing...' : isLogin ? 'Login to Dashboard' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
          
          <button 
            onClick={handleReset} 
            style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontWeight: 500, cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            System stuck? Clear session & refresh
          </button>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center', padding: '16px', background: 'var(--bg)', borderRadius: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
            <strong>💡 Pro Tip:</strong> If login fails on this device, ensure your <strong>Date & Time</strong> settings are set to "Automatic".
          </p>
        </div>
      </div>
    </div>
  );
}

