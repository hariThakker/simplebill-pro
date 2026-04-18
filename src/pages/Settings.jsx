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
    <div style={{ padding: '30px', maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '20px' }}>Business Setup</h2>
      <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '14px' }}>
        These details will appear at the top of your printed receipts.
      </p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>Company Name *</label>
          <input 
            required
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            value={formData.business_name}
            onChange={e => setFormData({...formData, business_name: e.target.value})}
            placeholder="e.g. My Awesome Store"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>Location / Address</label>
          <input 
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
            placeholder="e.g. 123 Main St, Mumbai"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>Phone Number</label>
            <input 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px' }}>GST Number (Optional)</label>
            <input 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              value={formData.gst_number}
              onChange={e => setFormData({...formData, gst_number: e.target.value})}
              placeholder="e.g. 27AAACR1234A1Z1"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '15px', marginTop: '10px', background: saved ? '#10b981' : '#2563eb' }}
        >
          {loading ? 'Saving...' : saved ? 'Saved Successfully! ✅' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
