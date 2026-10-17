import type { ReactNode } from 'react';

export function Notice({
  kind = 'info',
  title,
  children,
  className = '',
}: {
  kind?: 'info' | 'warn' | 'danger' | 'mock' | 'plain';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = kind === 'plain' ? 'notice' : `notice notice-${kind}`;
  return (
    <div className={`${cls} ${className}`} role={kind === 'danger' ? 'alert' : undefined}>
      {title && <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>}
      {children}
    </div>
  );
}
