import * as vscode from 'vscode';
import * as path from 'path';

type PickItem = vscode.QuickPickItem & { folder?: string; isAdd?: boolean };

/**
 * Определяет, какие папки учитываются.
 * Источник истины: настройка trackit.folders. Если она пуста,
 * учитываются открытые папки проекта.
 */
export class FolderSelector {
  /** Список абсолютных путей отслеживаемых папок. */
  getTrackedFolders(): string[] {
    const configured = vscode.workspace.getConfiguration('trackit').get<string[]>('folders', []);
    if (configured.length > 0) {
      return configured;
    }
    return (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
  }

  /** Проверяет, лежит ли файл внутри отслеживаемой папки. */
  isTracked(filePath: string): boolean {
    return this.getTrackedFolders().some(
      folder => filePath === folder || filePath.startsWith(folder + path.sep),
    );
  }

  /**
   * Показывает список открытых папок с отметками и кнопку добавления папки с диска.
   * Выбор сохраняется в настройках.
   */
  async pickFolders(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const current = new Set(this.getTrackedFolders());

    const items: PickItem[] = workspaceFolders.map(f => ({
      label: f.name,
      description: f.uri.fsPath,
      picked: current.has(f.uri.fsPath),
      folder: f.uri.fsPath,
    }));
    items.push({ label: '$(add) Добавить папку с диска...', isAdd: true, alwaysShow: true });

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: 'TrackIt: отслеживаемые папки',
      placeHolder: 'Отметьте папки, за которыми вести учёт',
    });
    if (!selected) {
      return;
    }

    let folders = selected.filter(i => i.folder !== undefined).map(i => i.folder as string);

    if (selected.some(i => i.isAdd)) {
      const chosen = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: 'Отслеживать',
        defaultUri: workspaceFolders[0]?.uri,
      });
      if (chosen) {
        folders.push(...chosen.map(uri => uri.fsPath));
      }
    }

    folders = [...new Set(folders)];
    if (folders.length === 0) {
      void vscode.window.showInformationMessage('TrackIt: не выбрано ни одной папки.');
      return;
    }

    const target = workspaceFolders.length > 0
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await vscode.workspace.getConfiguration('trackit').update('folders', folders, target);
  }
}