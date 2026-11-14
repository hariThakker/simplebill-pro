import { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

export default function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied!', className = '', showLabel = false, size = 15 }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`copy-button ${copied ? 'copied' : ''} ${className}`}
      title={copied ? copiedLabel : `Copy "${text}"`}
      aria-label={copied ? copiedLabel : `Copy ${text}`}
    >
      {copied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
      {showLabel && <span className="copy-button-label">{copied ? copiedLabel : label}</span>}
    </button>
  );
}
