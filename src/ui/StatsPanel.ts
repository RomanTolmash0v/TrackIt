import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Storage } from '../model/Storage';
import { FolderSelector } from '../config/FolderSelector';
import { buildSummary } from '../model/Aggregator';
import { Period } from '../model/types';

interface WebviewMessage {
  type: 'ready' | 'period';
  value?: Period;
}

/**
 * Панель статистики (webview). Открыта в единственном экземпляре.
 * Все расчёты выполняются здесь, в расширении. В webview передаются готовые данные.
 */
export class StatsPanel {
  private static instance: StatsPanel | undefined;
  private static refreshTimer: NodeJS.Timeout | undefined;

  private readonly panel: vscode.WebviewPanel;
  private period: Period = 'week';

  private constructor(
    extensionUri: vscode.Uri,
    private readonly storage: Storage,
    private readonly folders: FolderSelector,
  ) {
    this.panel = vscode.window.createWebviewPanel('trackit.stats', 'TrackIt', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    });

    const webview = this.panel.webview;
    const mediaUri = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', name)).toString();
    webview.html = getHtml(webview.cspSource, mediaUri('stats.css'), mediaUri('stats.js'));

    webview.onDidReceiveMessage((msg: WebviewMessage) => {
      if (msg.type === 'ready') {
        this.push();
      } else if (msg.type === 'period' && msg.value) {
        this.period = msg.value;
        this.push();
      }
    });

    this.panel.onDidDispose(() => {
      StatsPanel.instance = undefined;
    });
  }

  /** Открывает панель или показывает уже открытую. */
  static open(extensionUri: vscode.Uri, storage: Storage, folders: FolderSelector): void {
    if (StatsPanel.instance) {
      StatsPanel.instance.panel.reveal();
      return;
    }
    StatsPanel.instance = new StatsPanel(extensionUri, storage, folders);
  }

  /** Обновляет панель, если она открыта. Частые вызовы объединяются через таймер. */
  static refreshSoon(): void {
    if (!StatsPanel.instance) {
      return;
    }
    clearTimeout(StatsPanel.refreshTimer);
    StatsPanel.refreshTimer = setTimeout(() => StatsPanel.instance?.push(), 1000);
  }

  /** Отправляет в webview свежую сводку за выбранный период. */
  private push(): void {
    const summary = buildSummary(this.storage.getAll(), this.period, this.folders.getTrackedFolders());
    void this.panel.webview.postMessage({ type: 'data', summary });
  }
}

/** HTML-оболочка панели: подключает Chart.js из CDN и локальные файлы media/. */
function getHtml(cspSource: string, cssUri: string, jsUri: string): string {
  const nonce = crypto.randomBytes(16).toString('base64');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
  <link rel="stylesheet" href="${cssUri}">
  <title>TrackIt</title>
</head>
<body>
  <header>
    <h1>TrackIt</h1>
    <div class="periods">
      <button data-p="today">Сегодня</button>
      <button data-p="week">Неделя</button>
      <button data-p="month">Месяц</button>
      <button data-p="all">Всё время</button>
    </div>
  </header>

  <section class="cards">
    <div class="card"><span id="t-added">0</span><label>добавлено строк</label></div>
    <div class="card"><span id="t-removed">0</span><label>удалено строк</label></div>
    <div class="card"><span id="t-net">0</span><label>чистый прирост</label></div>
    <div class="card"><span id="t-edits">0</span><label>правок</label></div>
  </section>

  <section class="grid">
    <div class="panel wide"><h2>По дням</h2><canvas id="byDay"></canvas></div>
    <div class="panel"><h2>По часам суток</h2><canvas id="byHour"></canvas></div>
    <div class="panel"><h2>Файлы</h2><canvas id="byFile"></canvas></div>
    <div class="panel"><h2>Папки</h2><canvas id="byFolder"></canvas></div>
    <div class="panel wide"><h2>Когда пишете код: день недели × час</h2><div id="heat"></div></div>
  </section>

  <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}