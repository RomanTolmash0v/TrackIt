/**
 * Одно изменение текста, полученное из редактора.
 * Используется только для того, чтобы передать данные в агрегат.
 */
export interface EditRecord {
  /** Момент изменения. */
  timestamp: Date;
  /** Абсолютный путь к файлу. */
  file: string;
  /** Количество добавленных строк (переносов строки). */
  added: number;
  /** Количество удалённых строк. */
  removed: number;
}

/** Агрегат за один час по одному файлу. */
export interface BucketStats {
  added: number;
  removed: number;
  /** Число правок, которые попали в этот час. */
  edits: number;
}

/** Формат файла данных на диске. */
export interface StoredData {
  version: 1;
  /** Ключ: "YYYY-MM-DD|HH|путь к файлу". */
  buckets: Record<string, BucketStats>;
}

/** Период, за который показывается статистика. */
export type Period = 'today' | 'week' | 'month' | 'all';