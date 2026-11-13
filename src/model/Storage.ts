import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BucketStats, EditRecord, StoredData } from './types';
import { dayKey } from './time';

const FILE_NAME = 'trackit-data.json';
const SAVE_DELAY_MS = 2000;

/**
 * Хранит агрегаты в памяти и сохраняет их в JSON-файл в папке расширения.
 * Запись на диск откладывается: несколько изменений подряд сохраняются одним вызовом.
 */
export class Storage {
  private buckets: Record<string, BucketStats> = {};
  private readonly filePath: string;
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.filePath = path.join(context.globalStorageUri.fsPath, FILE_NAME);
  }

  /** Читает данные с диска. Если файла нет или он повреждён, начинаем с пустых данных. */
  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw) as StoredData;
      this.buckets = data.buckets ?? {};
    } catch {
      this.buckets = {};
    }
  }

  /** Добавляет изменение в агрегат текущего часа и планирует сохранение. */
  add(record: EditRecord): void {
    const key = makeKey(record.timestamp, record.file);
    const bucket = this.buckets[key] ?? { added: 0, removed: 0, edits: 0 };
    bucket.added += record.added;
    bucket.removed += record.removed;
    bucket.edits += 1;
    this.buckets[key] = bucket;
    this.scheduleSave();
  }

  /** Все агрегаты. Не изменяйте возвращаемый объект напрямую. */
  getAll(): Record<string, BucketStats> {
    return this.buckets;
  }

  /** Полностью очищает статистику и сохраняет пустой файл. */
  async reset(): Promise<void> {
    this.buckets = {};
    await this.save();
  }

  /** Немедленно сохраняет данные. Вызывается при выгрузке расширения. */
  async flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    await this.save();
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
  }

  private async save(): Promise<void> {
    const data: StoredData = { version: 1, buckets: this.buckets };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data), 'utf8');
  }
}

/** Ключ агрегата: дата, час и путь к файлу. */
export function makeKey(d: Date, file: string): string {
  const hour = String(d.getHours()).padStart(2, '0');
  return `${dayKey(d)}|${hour}|${file}`;
}