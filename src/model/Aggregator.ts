import * as path from 'path';
import { BucketStats, Period } from './types';
import { startKeyFor, weekdayIndex } from './time';

/** Одна строка агрегата после разбора ключа. */
export interface Row {
  day: string;
  hour: number;
  file: string;
  stats: BucketStats;
}

/** Точка на графике по дням. */
export interface DayPoint {
  day: string;
  added: number;
  removed: number;
  net: number;
}

/** Итог по файлу или папке. */
export interface NamedTotal {
  name: string;
  added: number;
  removed: number;
  net: number;
}

/** Всё, что нужно панели статистики, одним объектом. */
export interface Summary {
  totals: { added: number; removed: number; net: number; edits: number };
  byDay: DayPoint[];
  /** 24 значения: добавлено строк в каждый час суток. */
  byHour: number[];
  /** 7 строк (Пн..Вс) по 24 столбца (часы). */
  heatmap: number[][];
  byFile: NamedTotal[];
  byFolder: NamedTotal[];
}

const TOP_N = 15;

/**
 * Разбирает ключи агрегатов и оставляет только строки нужного периода
 * и отслеживаемых папок.
 */
export function parseRows(
  buckets: Record<string, BucketStats>,
  period: Period,
  folders: string[],
): Row[] {
  const start = startKeyFor(period);
  const rows: Row[] = [];
  for (const [key, stats] of Object.entries(buckets)) {
    const [day, hour, ...rest] = key.split('|');
    const file = rest.join('|');
    if (start !== undefined && day < start) {
      continue;
    }
    if (!isInFolders(file, folders)) {
      continue;
    }
    rows.push({ day, hour: Number(hour), file, stats });
  }
  return rows;
}

/** Проверяет, лежит ли файл внутри одной из папок. */
export function isInFolders(file: string, folders: string[]): boolean {
  return folders.some(folder => file === folder || file.startsWith(folder + path.sep));
}

/** Полный расчёт статистики для панели. */
export function buildSummary(
  buckets: Record<string, BucketStats>,
  period: Period,
  folders: string[],
): Summary {
  return summarize(parseRows(buckets, period, folders));
}

/** Складывает строки агрегатов по дням, часам, дням недели, файлам и папкам. */
export function summarize(rows: Row[]): Summary {
  const totals = { added: 0, removed: 0, net: 0, edits: 0 };
  const days = new Map<string, { added: number; removed: number }>();
  const byHour = new Array<number>(24).fill(0);
  const heatmap = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const files = new Map<string, NamedTotal>();
  const folders = new Map<string, NamedTotal>();

  for (const row of rows) {
    const { added, removed, edits } = row.stats;
    totals.added += added;
    totals.removed += removed;
    totals.edits += edits;

    const day = days.get(row.day) ?? { added: 0, removed: 0 };
    day.added += added;
    day.removed += removed;
    days.set(row.day, day);

    byHour[row.hour] += added;
    heatmap[weekdayIndex(row.day)][row.hour] += added;

    addTo(files, row.file, path.basename(row.file), added, removed);
    const folder = path.dirname(row.file);
    addTo(folders, folder, folderLabel(folder), added, removed);
  }
  totals.net = totals.added - totals.removed;

  const byDay: DayPoint[] = [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, v]) => ({ day, added: v.added, removed: v.removed, net: v.added - v.removed }));

  return {
    totals,
    byDay,
    byHour,
    heatmap,
    byFile: topN(files),
    byFolder: topN(folders),
  };
}

function addTo(
  map: Map<string, NamedTotal>,
  key: string,
  name: string,
  added: number,
  removed: number,
): void {
  const item = map.get(key) ?? { name, added: 0, removed: 0, net: 0 };
  item.added += added;
  item.removed += removed;
  item.net = item.added - item.removed;
  map.set(key, item);
}

function topN(map: Map<string, NamedTotal>): NamedTotal[] {
  return [...map.values()].sort((a, b) => b.added - a.added).slice(0, TOP_N);
}

/** Короткое имя папки: последние два сегмента пути. */
function folderLabel(p: string): string {
  return p.split(path.sep).slice(-2).join('/');
}