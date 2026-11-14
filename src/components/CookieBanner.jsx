import { useState, useEffect } from 'react';
import { ShieldCheckIcon, XIcon } from './Icons';

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('simplebill_cookie_consent');
    if (!consent) {
      // Small delay so it doesn't jarringly pop up immediately on first paint
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const handleConsent = (mode) => {
    localStorage.setItem('simplebill_cookie_consent', mode);
    setShow(false);
  };

  if (!show) return null;

  return (
    <aside className="cookie-banner" role="region" aria-label="Privacy and Local Storage Notice">
      <div className="cookie-banner-content">
        <div className="cookie-banner-icon">
          <ShieldCheckIcon size={20} />
        </div>
        <div className="cookie-banner-text">
          <strong>Privacy & Device Storage</strong>
          <p>
            SimpleBill Pro uses browser storage to keep you signed in, remember your branch preferences, and enable high-speed offline POS caching.
          </p>
        </div>
      </div>
      <div className="cookie-banner-actions">
        <button
          type="button"
          onClick={() => handleConsent('essential')}
          className="btn-banner btn-banner-secondary"
        >
          Essential Only
        </button>
        <button
          type="button"
          onClick={() => handleConsent('all')}
          className="btn-banner btn-banner-primary"
        >
          Accept All
        </button>
        <button
          type="button"
          onClick={() => handleConsent('dismiss')}
          className="btn-banner-close"
          aria-label="Dismiss cookie notice"
        >
          <XIcon size={16} />
        </button>
      </div>
    </aside>
  );
}
