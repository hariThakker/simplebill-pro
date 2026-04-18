import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    location: '',
    phone: '',
    gst_number: ''
  });

  useEffect(() => {
    fetchSettings();
    window.addEventListener('groupChanged', fetchSettings);
    return () => window.removeEventListener('groupChanged', fetchSettings);
  }, []);

  async function fetchSettings() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;

    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (data) {
      setFormData({
        business_name: data.business_name || '',
        location: data.location || '',
        phone: data.phone || '',
        gst_number: data.gst_number || ''
      });
    } else {
      setFormData({ business_name: '', location: '', phone: '', gst_number: '' });
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const groupId = localStorage.getItem('selectedGroupId');

    // Check if settings exist for this group
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle();

    let error;
    if (existing) {
      const { error: err } = await supabase
        .from('settings')
        .update(formData)
        .eq('group_id', groupId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('settings')
        .insert([{ ...formData, group_id: groupId }]);
      error = err;
    }

    setLoading(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert('Error saving settings: ' + error.message);
    }
  }

  return (
    <div className="page-transition" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Business Setup</h2>
        <p style={{ color: 'var(--text-dim)' }}>
          Configure details for your cloud-printed receipts.
        </p>
      </div>

      <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>COMPANY NAME *</label>
          <input 
            required
            className="input-v2"
            value={formData.business_name}
            onChange={e => setFormData({...formData, business_name: e.target.value})}
            placeholder="e.g. My Awesome Store"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>LOCATION / ADDRESS</label>
          <input 
            className="input-v2"
            value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
            placeholder="e.g. 123 Main St, Mumbai"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>PHONE NUMBER</label>
            <input 
              className="input-v2"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>GST NUMBER</label>
            <input 
              className="input-v2"
              value={formData.gst_number}
              onChange={e => setFormData({...formData, gst_number: e.target.value})}
              placeholder="Optional"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn"
          style={{ padding: '16px', background: saved ? 'var(--success)' : 'var(--primary)', color: 'white', borderRadius: '12px', fontSize: '15px', marginTop: '12px' }}
        >
          {loading ? 'Saving Data...' : saved ? 'Successfully Saved! ✅' : 'Save Business Settings'}
        </button>
      </form>
    </div>
  );
}
