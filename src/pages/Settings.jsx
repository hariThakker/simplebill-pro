import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { fallbackNativePrint } from '../utils/printer';
import {
  SettingsIcon,
  Building2Icon,
  PrinterIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  PlusIcon,
  Trash2Icon,
  CheckCircle2Icon,
  XIcon,
  AlertTriangleIcon
} from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import CopyButton from '../components/CopyButton';
import { useToast } from '../components/Toast';

export default function Settings() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const onThemeChange = () => {
      setCurrentTheme(localStorage.getItem('theme') || 'system');
    };
    window.addEventListener('themeChanged', onThemeChange);
    return () => window.removeEventListener('themeChanged', onThemeChange);
  }, []);

  // Delete branch modal
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const [formData, setFormData] = useState({
    business_name: '',
    location: '',
    phone: '',
    gst_number: '',
    custom_message: '',
    printer_mode: 'ble'
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [discountRates, setDiscountRates] = useState(() => localStorage.getItem('discountRates') || '5,10,15,20,25');
  const [autoPrintToken, setAutoPrintToken] = useState(() => localStorage.getItem('autoPrintToken') === 'true');

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) setGroups(data);
  }, []);

  const fetchSettings = useCallback(async () => {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;

    const localLogo = (groupId ? localStorage.getItem(`receiptLogo_${groupId}`) : null) || localStorage.getItem('receiptLogo') || '';

    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (data) {
      const activeLogo = data.logo_url || localLogo || '';
      setFormData({
        business_name: data.business_name || '',
        location: data.location || '',
        phone: data.phone || '',
        gst_number: data.gst_number || '',
        custom_message: data.custom_message || '',
        printer_mode: data.printer_mode || 'ble',
        logo_url: activeLogo
      });
      setLogoUrl(activeLogo);
      if (activeLogo) {
        localStorage.setItem(`receiptLogo_${groupId}`, activeLogo);
        localStorage.setItem('receiptLogo', activeLogo);
      }
      localStorage.setItem('printerMode', data.printer_mode || 'ble');
    } else {
      setFormData({
        business_name: '',
        location: '',
        phone: '',
        gst_number: '',
        custom_message: '',
        printer_mode: 'ble',
        logo_url: localLogo
      });
      setLogoUrl(localLogo);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchGroups();
    window.addEventListener('groupChanged', fetchSettings);
    return () => window.removeEventListener('groupChanged', fetchSettings);
  }, [fetchSettings, fetchGroups]);

  async function handleAddGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);

    try {
      const { error } = await supabase.from('groups').insert([{ name: newGroupName.trim() }]);
      if (error) throw error;

      setNewGroupName('');
      fetchGroups();
      window.dispatchEvent(new Event('groupsUpdated'));
      toast.success(`Store branch "${newGroupName.trim()}" added!`);
    } catch (err) {
      toast.error('Failed to add branch: ' + err.message);
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleConfirmDeleteGroup() {
    if (!groupToDelete) return;
    setDeletingGroup(true);

    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupToDelete.id);
      if (error) throw error;

      fetchGroups();
      window.dispatchEvent(new Event('groupsUpdated'));
      if (localStorage.getItem('selectedGroupId') === groupToDelete.id) {
        localStorage.removeItem('selectedGroupId');
        window.dispatchEvent(new Event('groupChanged'));
      }
      toast.success(`Branch "${groupToDelete.name}" deleted`);
      setGroupToDelete(null);
    } catch (err) {
      toast.error('Failed to delete branch: ' + err.message);
    } finally {
      setDeletingGroup(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const groupId = localStorage.getItem('selectedGroupId');

    if (!groupId) {
      toast.warning('Please select an active store branch first');
      setLoading(false);
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('group_id', groupId)
        .maybeSingle();

      const payload = { ...formData, logo_url: logoUrl };

      let error;
      if (existing) {
        const res = await supabase.from('settings').update(payload).eq('group_id', groupId);
        error = res.error;
      } else {
        const res = await supabase.from('settings').insert([{ ...payload, group_id: groupId }]);
        error = res.error;
      }

      if (error) throw error;

      if (logoUrl) {
        if (groupId) localStorage.setItem(`receiptLogo_${groupId}`, logoUrl);
        localStorage.setItem('receiptLogo', logoUrl);
      } else {
        if (groupId) localStorage.removeItem(`receiptLogo_${groupId}`);
        localStorage.removeItem('receiptLogo');
      }

      setSaved(true);
      localStorage.setItem('printerMode', formData.printer_mode);
      localStorage.setItem('discountRates', discountRates);
      localStorage.setItem('autoPrintToken', autoPrintToken ? 'true' : 'false');
      toast.success('Configuration saved successfully');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleTestPrint = () => {
    const testContent = `\n================================\n       SIMPLEBILL PRO TEST\n================================\nPrinter check: PASS\nThermal slip feed OK.\nDate: ${new Date().toLocaleDateString('en-IN')}\nTime: ${new Date().toLocaleTimeString('en-IN')}\n================================\n\n\n\n`;
    fallbackNativePrint(testContent, logoUrl);
    toast.info('Test slip dispatched with logo');
  };

  const handleThemeSelect = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new Event('themeChanged'));
    toast.info(`Theme set to ${theme}`);
  };

  return (
    <div className="page-transition" style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Store Settings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
          Configure business profile, branches, printers, and appearance
        </p>
      </div>

      {/* Group & Branch Management */}
      <section className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Building2Icon size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Stores & Branches</h3>
        </div>

        <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <input
            type="text"
            required
            className="input-v2"
            placeholder="New store / branch name (e.g. Koramangala Hub)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button
            type="submit"
            disabled={addingGroup}
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            {addingGroup ? 'Adding...' : 'Add Branch'}
          </button>
        </form>

        <label className="form-label">Available Branches ({groups.length})</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
          {groups.map((g) => (
            <div
              key={g.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--card-subtle)',
                color: 'var(--text)',
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <span>{g.name}</span>
              <button
                type="button"
                onClick={() => setGroupToDelete(g)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={`Delete branch "${g.name}"`}
                aria-label={`Delete ${g.name}`}
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Business Profile Configuration */}
      <section className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <SettingsIcon size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Invoice & Receipt Profile</h3>
        </div>

        {saved && (
          <div className="form-success-banner">
            <CheckCircle2Icon size={16} />
            <span>Store settings saved successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Company / Business Name *</label>
            <input
              required
              className="input-v2"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="e.g. Coastal Brew & Cafe"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Location / Address</label>
              <input
                className="input-v2"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ground Floor, 12th Main Rd"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Store Hotline Phone</label>
              <input
                className="input-v2"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">GST Identification Number (GSTIN)</label>
            <input
              className="input-v2 font-mono"
              value={formData.gst_number}
              onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
              placeholder="e.g. 29AAAAA0000A1Z5"
            />
          </div>

          {/* Logo upload */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Receipt Logo</label>
            {logoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--card-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <img src={logoUrl} alt="Logo Preview" style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: 'var(--radius-xs)', background: 'white', padding: '4px' }} />
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl('');
                      const gid = localStorage.getItem('selectedGroupId');
                      if (gid) localStorage.removeItem(`receiptLogo_${gid}`);
                      localStorage.removeItem('receiptLogo');
                      toast.info('Logo removed');
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    Remove Logo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 1024 * 1024) {
                        toast.error('Please choose an image under 1MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const res = reader.result;
                        setLogoUrl(res);
                        const gid = localStorage.getItem('selectedGroupId');
                        if (gid) localStorage.setItem(`receiptLogo_${gid}`, res);
                        localStorage.setItem('receiptLogo', res);
                        toast.success('Logo uploaded and ready for receipts');
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="input-v2"
                  style={{ padding: '8px' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  PNG or JPG logo rendered on digital receipts and printouts (Max 1MB).
                </p>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Receipt Footer Note</label>
            <textarea
              className="input-v2"
              style={{ minHeight: '70px', resize: 'vertical' }}
              value={formData.custom_message}
              onChange={(e) => setFormData({ ...formData, custom_message: e.target.value })}
              placeholder="e.g. Thank you for your visit! Follow @ourstore on Instagram."
            />
          </div>

          {/* Printer Mode Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Printer Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                className={`btn ${formData.printer_mode === 'ble' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormData({ ...formData, printer_mode: 'ble' })}
              >
                <PrinterIcon size={16} />
                <span>Bluetooth ESC/POS</span>
              </button>
              <button
                type="button"
                className={`btn ${formData.printer_mode === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormData({ ...formData, printer_mode: 'digital' })}
              >
                <span>Digital Slip Only</span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <p style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                {formData.printer_mode === 'ble'
                  ? 'Bills are dispatched directly to paired Web Bluetooth thermal printers.'
                  : 'A digital slip pop-up appears on checkout for image download or native printing.'}
              </p>
              <button
                type="button"
                onClick={handleTestPrint}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Test Print
              </button>
            </div>
          </div>

          {/* Fast-Food Counter Token Auto-Print */}
          <div className="form-group" style={{ marginBottom: 0, padding: '14px', background: 'var(--card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Fast-Food Counter Token Mode</span>
                  <span className="badge badge-accent" style={{ fontSize: '9px', padding: '1px 6px' }}>QSR</span>
                </label>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Automatically print a food pickup token slip (with large #XX number &amp; preparation checklist) alongside customer bill.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={autoPrintToken}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoPrintToken(checked);
                    localStorage.setItem('autoPrintToken', checked ? 'true' : 'false');
                    toast.success(checked ? 'Auto-print counter token enabled' : 'Auto-print counter token disabled');
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          {/* Discount Wheel Rates */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Discount Wheel Slices (%)</label>
            <input
              className="input-v2 font-mono"
              value={discountRates}
              onChange={(e) => setDiscountRates(e.target.value)}
              placeholder="0,5,10,15,20,25"
            />
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Comma-separated percentage values for POS Promotional Discount Wheel.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Saving Changes...' : 'Save Store Configuration'}
          </button>
        </form>
      </section>

      {/* Appearance & Dark Mode Toggle Section */}
      <section className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <SunIcon size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 800 }}>Theme & Appearance</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Choose your preferred theme across desktop and mobile devices.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { id: 'light', label: 'Light', icon: SunIcon, desc: 'Colonial White & Pine' },
            { id: 'dark', label: 'Dark', icon: MoonIcon, desc: 'Green Waterloo & Forest' },
            { id: 'system', label: 'System', icon: MonitorIcon, desc: 'Auto System Match' }
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleThemeSelect(t.id)}
                className={`card ${isSelected ? 'active' : ''}`}
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  background: isSelected ? 'var(--primary-subtle)' : 'var(--card-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Icon size={22} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-dim)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Confirm Branch Deletion Modal */}
      <ConfirmModal
        isOpen={!!groupToDelete}
        title="Delete Store Branch?"
        message={`Are you sure you want to delete branch "${groupToDelete?.name}"? Invoices and inventory records associated with this branch should be reviewed.`}
        confirmText="Yes, Delete Branch"
        cancelText="Cancel"
        isDestructive={true}
        loading={deletingGroup}
        onConfirm={handleConfirmDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
      />
    </div>
  );
}
