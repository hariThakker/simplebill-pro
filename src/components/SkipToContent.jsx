import React from 'react';

export default function SkipToContent({ targetId = 'main-content' }) {
  return (
    <a href={`#${targetId}`} className="skip-to-content">
      Skip to main content
    </a>
  );
}
