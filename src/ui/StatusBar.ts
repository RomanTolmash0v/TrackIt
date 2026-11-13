import * as vscode from 'vscode';
import { Storage } from '../model/Storage';
import { FolderSelector } from '../config/FolderSelector';
import { parseRows, summarize } from '../model/Aggregator';

/** Элемент строки состояния: строк за сегодня по отслеживаемым папкам. */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(
    private readonly storage: Storage,
    private readonly folders: FolderSelector,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'trackit.openStats';
    this.item.tooltip = 'TrackIt: открыть статистику';
  }

  /** Пересчитывает счётчик и показывает или скрывает элемент по настройке. */
  refresh(): void {
    const enabled = vscode.workspace.getConfiguration('trackit').get<boolean>('showStatusBar', true);
    if (!enabled) {
      this.item.hide();
      return;
    }
    const rows = parseRows(this.storage.getAll(), 'today', this.folders.getTrackedFolders());
    const { totals } = summarize(rows);
    this.item.text = `$(pencil) ${totals.added} стр. сегодня`;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}