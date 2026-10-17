import type { DataSource } from '@/sensors/types';
import { SOURCE_LABEL } from '@/poe/types';

export function SourceBadge({ source, big = false }: { source: DataSource; big?: boolean }) {
  const cls = source === 'mock' ? 'badge-mock' : source === 'live' ? 'badge-live' : 'badge-imported';
  return (
    <span className={`badge ${cls}`} style={big ? { fontSize: '0.9rem', padding: '4px 12px' } : undefined} data-source={source}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function RoleBadge({ role }: { role: 'current' | 'voltage' }) {
  return <span className={`badge badge-${role}`}>{role === 'current' ? '전류 (mA)' : '전압 (V)'}</span>;
}
