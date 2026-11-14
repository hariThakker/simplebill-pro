import React from 'react';

export function Skeleton({ className = '', style = {}, variant = 'rect' }) {
  return (
    <div
      className={`skeleton skeleton-${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonMetric() {
  return (
    <div className="card skeleton-card">
      <Skeleton style={{ width: '40%', height: '14px', marginBottom: '12px' }} />
      <Skeleton style={{ width: '70%', height: '36px', marginBottom: '12px' }} />
      <Skeleton style={{ width: '50%', height: '16px' }} />
    </div>
  );
}

export function SkeletonProductCard() {
  return (
    <div className="product-card skeleton-card">
      <Skeleton variant="circle" style={{ width: '48px', height: '48px', margin: '0 auto 12px' }} />
      <Skeleton style={{ width: '75%', height: '16px', margin: '0 auto 8px' }} />
      <Skeleton style={{ width: '45%', height: '18px', margin: '0 auto' }} />
    </div>
  );
}

export function SkeletonTableRow({ cols = 4 }) {
  return (
    <div className="skeleton-row" style={{ display: 'flex', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} style={{ flex: i === 0 ? 2 : 1, height: '18px' }} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3, children }) {
  return (
    <div className="skeleton-container" role="status" aria-label="Loading content...">
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {children || <SkeletonCard />}
        </React.Fragment>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card skeleton-card" style={{ padding: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Skeleton style={{ width: '35%', height: '22px' }} />
        <Skeleton style={{ width: '20%', height: '22px' }} />
      </div>
      <Skeleton style={{ width: '80%', height: '14px', marginBottom: '10px' }} />
      <Skeleton style={{ width: '60%', height: '14px' }} />
    </div>
  );
}
