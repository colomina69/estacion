import type { CustomRange } from '../types/weather';

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateInput(ms: number): string {
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatTimeInput(ms: number): string {
  const date = new Date(ms);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateTimeInput(ms: number): string {
  return `${formatDateInput(ms)} ${formatTimeInput(ms)}`;
}

function validDate(year: number, month: number, day: number): number | null {
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

export function parseDateInput(value: string): number | null {
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (dmy) {
    return validDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (ymd) {
    return validDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }
  return null;
}

export function parseCustomRange(
  startValue: string,
  endValue: string,
): { ok: true; range: CustomRange } | { ok: false; error: string } {
  const start = parseDateInput(startValue);
  if (start === null) {
    return { ok: false, error: 'La fecha inicial debe tener formato DD-MM-AAAA.' };
  }
  const endDay = parseDateInput(endValue);
  if (endDay === null) {
    return { ok: false, error: 'La fecha final debe tener formato DD-MM-AAAA.' };
  }
  const end = endDay + DAY_MS - 1;
  if (start > end) {
    return { ok: false, error: 'La fecha inicial no puede ser posterior a la final.' };
  }
  return { ok: true, range: { start, end } };
}

export function validateCustomRange(
  start: number,
  end: number,
): string | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'El rango de fechas no es válido.';
  }
  if (end <= start) {
    return 'La fecha final debe ser posterior a la inicial.';
  }
  return null;
}

export function bucketMsForDuration(durationMs: number): number {
  const targetPoints = 500;
  const raw = durationMs / targetPoints;
  const minutes = Math.max(1, Math.ceil(raw / 60_000));
  return Math.min(minutes, 1_440) * 60_000;
}

export function formatDateRange(range: CustomRange): string {
  return `${formatDateInput(range.start)} – ${formatDateInput(range.end)}`;
}

export function formatDateTimeRange(range: CustomRange): string {
  return `${formatDateTimeInput(range.start)} – ${formatDateTimeInput(range.end)}`;
}
