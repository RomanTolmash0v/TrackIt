import * as vscode from 'vscode';
import { EditRecord } from '../model/types';
import { FolderSelector } from '../config/FolderSelector';

/**
 * Слушает изменения документов и считает добавленные и удалённые строки.
 *
 * Новая строка появляется при вставке переноса строки (Enter), поэтому:
 * - добавлено = число переносов во вставленном тексте;
 * - удалено = число переносов внутри удаляемого диапазона.
 * Обычный набор символов без Enter строк не меняет.
 */
export class ChangeTracker implements vscode.Disposable {
  private readonly subscription: vscode.Disposable;

  /**
   * @param folders   источник списка отслеживаемых папок
   * @param onRecord  вызывается для каждого изменения внутри отслеживаемых папок
   */
  constructor(
    private readonly folders: FolderSelector,
    private readonly onRecord: (record: EditRecord) => void,
  ) {
    this.subscription = vscode.workspace.onDidChangeTextDocument(event => this.handle(event));
  }

  /** Обрабатывает пакет изменений одного документа. */
  private handle(event: vscode.TextDocumentChangeEvent): void {
    const doc = event.document;
    if (doc.uri.scheme !== 'file') {
      return;
    }
    const file = doc.uri.fsPath;
    if (!this.folders.isTracked(file)) {
      return;
    }
    for (const change of event.contentChanges) {
      const added = countNewlines(change.text);
      const removed = change.range.end.line - change.range.start.line;
      if (added === 0 && removed === 0) {
        continue;
      }
      this.onRecord({ timestamp: new Date(), file, added, removed });
    }
  }

  dispose(): void {
    this.subscription.dispose();
  }
}

/** Считает символы перевода строки в тексте. */
export function countNewlines(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === '\n') {
      count++;
    }
  }
  return count;
}