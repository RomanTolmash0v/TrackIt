/* global Chart, acquireVsCodeApi */
(function () {
  const vscode = acquireVsCodeApi();
  const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const ACCENT = '#7c5cff';
  const ACCENT_2 = '#ff6b8a';
  const charts = {};

  Chart.defaults.color = '#9aa0a6';
  Chart.defaults.borderColor = 'rgba(127,127,127,0.2)';

  function byId(id) {
    return document.getElementById(id);
  }

  /** Создаёт график при первом вызове, дальше только обновляет данные. */
  function setChart(id, config) {
    if (charts[id]) {
      charts[id].data = config.data;
      charts[id].update();
    } else {
      charts[id] = new Chart(byId(id), config);
    }
  }

  function render(summary) {
    const t = summary.totals;
    byId('t-added').textContent = t.added;
    byId('t-removed').textContent = t.removed;
    byId('t-net').textContent = t.net;
    byId('t-edits').textContent = t.edits;

    setChart('byDay', {
      type: 'bar',
      data: {
        labels: summary.byDay.map(d => d.day.slice(5)),
        datasets: [
          { label: 'Добавлено', data: summary.byDay.map(d => d.added), backgroundColor: ACCENT, borderRadius: 4 },
          { label: 'Удалено', data: summary.byDay.map(d => d.removed), backgroundColor: ACCENT_2, borderRadius: 4 },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });

    setChart('byHour', {
      type: 'bar',
      data: {
        labels: summary.byHour.map((_, h) => String(h).padStart(2, '0')),
        datasets: [{ label: 'Строк', data: summary.byHour, backgroundColor: ACCENT, borderRadius: 3 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    setChart('byFile', horizontalBar(summary.byFile));
    setChart('byFolder', horizontalBar(summary.byFolder));

    renderHeatmap(summary.heatmap);
  }

  function horizontalBar(items) {
    return {
      type: 'bar',
      data: {
        labels: items.map(i => i.name),
        datasets: [{ label: 'Добавлено', data: items.map(i => i.added), backgroundColor: ACCENT, borderRadius: 3 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
      },
    };
  }

  function renderHeatmap(matrix) {
    const el = byId('heat');
    el.textContent = '';
    const max = Math.max(1, ...matrix.map(row => Math.max(...row)));

    const grid = document.createElement('div');
    grid.className = 'heat';
    grid.appendChild(cell('', 'head'));
    for (let h = 0; h < 24; h++) {
      grid.appendChild(cell(String(h), 'head'));
    }

    matrix.forEach((row, wd) => {
      grid.appendChild(cell(WEEKDAYS[wd], 'label'));
      row.forEach((value, h) => {
        const c = cell('', 'cell');
        if (value > 0) {
          c.style.background = `rgba(124, 92, 255, ${0.15 + (0.85 * value) / max})`;
        }
        c.title = `${WEEKDAYS[wd]} ${String(h).padStart(2, '0')}:00 — ${value} стр.`;
        grid.appendChild(c);
      });
    });
    el.appendChild(grid);
  }

  function cell(text, className) {
    const d = document.createElement('div');
    d.className = className;
    d.textContent = text;
    return d;
  }

  const periodButtons = document.querySelectorAll('.periods button');
  periodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      periodButtons.forEach(b => b.classList.toggle('active', b === btn));
      vscode.postMessage({ type: 'period', value: btn.dataset.p });
    });
  });
  document.querySelector('.periods button[data-p="week"]').classList.add('active');

  window.addEventListener('message', event => {
    if (event.data.type === 'data') {
      render(event.data.summary);
    }
  });

  vscode.postMessage({ type: 'ready' });
})();