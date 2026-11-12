export function formatClock(ms: number | null): string {
  if (ms === null) return '—';
  const date = new Date(ms);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatShortTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatDateTime(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(ms: number | null, now = Date.now()): string {
  if (ms === null) return 'sin datos';
  const diff = Math.max(0, now - ms);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}
