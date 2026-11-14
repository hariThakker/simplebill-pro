import { useState, useEffect } from 'react';
import { HelpCircleIcon, PhoneIcon, MapPinIcon, PrinterIcon, XIcon, ShieldCheckIcon, ClockIcon } from './Icons';
import CopyButton from './CopyButton';

export default function FloatingContact({ currentGroup, businessSettings }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const businessPhone = businessSettings?.phone || '+91 98765 43210';
  const businessName = businessSettings?.business_name || currentGroup?.name || 'SimpleBill Store';
  const gstNumber = businessSettings?.gst_number || '29AAAAA0000A1Z5';
  const location = businessSettings?.location || 'Main Counter, Ground Floor';

  return (
    <>
      <div className="floating-contact-container">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`floating-contact-btn ${isOpen ? 'active' : ''}`}
          aria-expanded={isOpen}
          aria-label="Open support and branch contact card"
          title="Branch Contact & Support"
        >
          {isOpen ? <XIcon size={20} /> : <HelpCircleIcon size={20} />}
          <span className="floating-contact-label">Help & Info</span>
        </button>

        {isOpen && (
          <div className="floating-contact-card page-transition" role="dialog" aria-label="Branch Contact and Support">
            <div className="floating-contact-header">
              <div>
                <span className="floating-contact-badge">Store Support</span>
                <h4 className="floating-contact-title">{businessName}</h4>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="floating-contact-body">
              <div className="contact-detail-row">
                <MapPinIcon size={16} className="contact-icon" />
                <div className="contact-detail-content">
                  <span className="contact-label">Location / Branch</span>
                  <span className="contact-value">{location}</span>
                </div>
              </div>

              <div className="contact-detail-row">
                <PhoneIcon size={16} className="contact-icon" />
                <div className="contact-detail-content">
                  <span className="contact-label">Store Hotline</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <a href={`tel:${businessPhone.replace(/\s+/g, '')}`} className="contact-link">
                      {businessPhone}
                    </a>
                    <CopyButton text={businessPhone} size={13} />
                  </div>
                </div>
              </div>

              <div className="contact-detail-row">
                <ShieldCheckIcon size={16} className="contact-icon" />
                <div className="contact-detail-content">
                  <span className="contact-label">GSTIN Identification</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="contact-value font-mono">{gstNumber}</span>
                    <CopyButton text={gstNumber} size={13} />
                  </div>
                </div>
              </div>

              <div className="contact-divider" />

              <div className="printer-tips-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <PrinterIcon size={15} style={{ color: 'var(--primary)' }} />
                  <strong style={{ fontSize: '12px' }}>Thermal Printer Quick Guide</strong>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Keep Bluetooth turned ON. Standard 58mm & 80mm ESC/POS printers connect instantly from the top bar. Use Chrome or Edge on Android / Desktop for Web Bluetooth.
                </p>
              </div>

              <div className="contact-footer-note">
                <ClockIcon size={13} />
                <span>SimpleBill Pro v2.5 &bull; Desert Sunset Edition</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
