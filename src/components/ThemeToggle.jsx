import React from 'react';
import { SunIcon, MoonIcon, MonitorIcon } from './Icons';

export default function ThemeToggle({ theme = 'system', onChange, fullWidth = false }) {
  const options = [
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'system', label: 'System', icon: MonitorIcon }
  ];

  return (
    <div
      className={`theme-toggle-group ${fullWidth ? 'full-width' : ''}`}
      role="radiogroup"
      aria-label="Color theme selection"
    >
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onChange) onChange(opt.value);
            }}
            title={`Switch to ${opt.label} mode`}
          >
            <Icon size={13} />
            <span className="theme-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
