import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Secondary client to register staff without affecting owner session
const authClient = createClient(
  'https://qblpecdpudamykvgqalx.supabase.co', 
  'sb_publishable_tlMLvbA4DsJnIrXWVMVbqA_KuSKdjel',
  { auth: { persistSession: false } }
);

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff'
  });

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
    // Fetch profiles that have role='staff'
    const { data } = await supabase.from('profiles').select('*').eq('role', 'staff');
    if (data) setStaff(data);
    setLoading(false);
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const { data, error } = await authClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            role: 'staff'
          }
        }
      });

      if (error) throw error;

      alert(`Staff account created for ${formData.full_name}! \n\nThey can now login with: \nEmail: ${formData.email} \nPassword: ${formData.password}`);
      setShowAdd(false);
      setFormData({ email: '', password: '', full_name: '', role: 'staff' });
      fetchStaff();
    } catch (err) {
      alert('Error creating staff: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  }

  if (!isOwner) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900 }}>Access Denied</h2>
        <p style={{ color: 'var(--text-dim)' }}>Only Company Owners can manage staff members.</p>
      </div>
    );
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Staff Management</h2>
          <p style={{ color: 'var(--text-dim)' }}>Manage your team and their access levels.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ borderRadius: '12px' }}>
          + Invite Staff
        </button>
      </div>

      {showAdd && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div className="card page-transition" style={{ maxWidth: '450px', width: '100%', padding: '32px' }}>
              <h3 style={{ marginBottom: '8px' }}>Add New Staff</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '24px' }}>Enter the details of your staff member.</p>
              
              <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>FULL NAME</label>
                    <input className="input-v2" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="e.g. Rahul Sharma" />
                 </div>
                 <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>EMAIL ADDRESS</label>
                    <input className="input-v2" required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="rahul@example.com" />
                 </div>
                 <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>SET PASSWORD</label>
                    <input className="input-v2" required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
                 </div>

                 <div style={{ background: 'rgba(var(--accent-raw), 0.05)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--accent)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, lineHeight: '1.4' }}>
                       💡 <strong>Tip:</strong> After you create this account, the staff member can login immediately with the credentials above.
                    </p>
                 </div>

                 <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="submit" disabled={isCreating} className="btn btn-primary" style={{ flex: 1, borderRadius: '12px' }}>
                       {isCreating ? 'Creating...' : 'Create Account'}
                    </button>
                    <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading team...</div>
        ) : staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>👥</div>
            <p style={{ fontWeight: 600, color: 'var(--text-dim)' }}>No staff members added yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1px', background: 'var(--border)' }}>
            {staff.map(m => (
              <div key={m.id} style={{ background: 'var(--card)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {m.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.full_name || 'Staff Member'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{m.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(var(--accent-raw), 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                  {m.role}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
