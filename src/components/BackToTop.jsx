import { useState, useEffect } from 'react';
import { ArrowUpIcon } from './Icons';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop || window.scrollY;
      setVisible(scrolled > 300);
    };

    window.addEventListener('scroll', toggleVisible, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="back-to-top-btn"
      aria-label="Back to top of page"
      title="Back to top"
    >
      <ArrowUpIcon size={18} strokeWidth={2.5} />
    </button>
  );
}
