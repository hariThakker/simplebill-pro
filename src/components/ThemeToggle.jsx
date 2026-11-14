import React from 'react';
import { SunIcon, MoonIcon, MonitorIcon } from './Icons';

export default function ThemeToggle({ theme, onChange }) {
  const options = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: MonitorIcon }
  ];

  return (
    <div className="theme-toggle-group" role="radiogroup" aria-label="Color theme selection">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`theme-toggle-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
            title={`Switch to ${opt.label} mode`}
          >
            <Icon size={15} />
            <span className="theme-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
