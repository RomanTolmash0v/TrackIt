import * as vscode from 'vscode';
import { Storage } from './model/Storage';
import { FolderSelector } from './config/FolderSelector';
import { ChangeTracker } from './tracking/ChangeTracker';
import { StatusBar } from './ui/StatusBar';
import { StatsPanel } from './ui/StatsPanel';

/**
 * Точка входа расширения. Вызывается VS Code при запуске.
 * Здесь создаются все модули и регистрируются команды.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new Storage(context);
  await storage.load();

  const folders = new FolderSelector();
  const statusBar = new StatusBar(storage, folders);

  const tracker = new ChangeTracker(folders, record => {
    storage.add(record);
    statusBar.refresh();
    StatsPanel.refreshSoon();
  });

  const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('trackit')) {
      statusBar.refresh();
      StatsPanel.refreshSoon();
    }
  });

  context.subscriptions.push(
    tracker,
    statusBar,
    configWatcher,
    { dispose: () => void storage.flush() },
    vscode.commands.registerCommand('trackit.openStats', () =>
      StatsPanel.open(context.extensionUri, storage, folders),
    ),
    vscode.commands.registerCommand('trackit.selectFolders', async () => {
      await folders.pickFolders();
      statusBar.refresh();
      StatsPanel.refreshSoon();
    }),
    vscode.commands.registerCommand('trackit.resetData', async () => {
      const answer = await vscode.window.showWarningMessage(
        'TrackIt: удалить всю накопленную статистику?',
        { modal: true },
        'Удалить',
      );
      if (answer !== 'Удалить') {
        return;
      }
      await storage.reset();
      statusBar.refresh();
      StatsPanel.refreshSoon();
    }),
  );

  statusBar.refresh();
}

/** Вызывается при выключении расширения. Сохранение выполняется через dispose. */
export function deactivate(): void {}