import { Period } from './types';

/**
 * Дата в виде "YYYY-MM-DD" по местному времени.
 * Такой формат сравнивается как строка, что удобно для фильтрации по периоду.
 */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Возвращает день недели для ключа "YYYY-MM-DD".
 * 0 = понедельник, 6 = воскресенье.
 */
export function weekdayIndex(day: string): number {
  return (new Date(day + 'T00:00:00').getDay() + 6) % 7;
}

/**
 * Первый день периода в формате "YYYY-MM-DD".
 * Для 'all' возвращает undefined, то есть фильтра нет.
 * Неделя начинается с понедельника.
 */
export function startKeyFor(period: Period, now: Date = new Date()): string | undefined {
  if (period === 'all') {
    return undefined;
  }
  const d = new Date(now);
  if (period === 'today') {
    return dayKey(d);
  }
  if (period === 'week') {
    d.setDate(d.getDate() - weekdayIndex(dayKey(d)));
    return dayKey(d);
  }
  d.setDate(1);
  return dayKey(d);
}