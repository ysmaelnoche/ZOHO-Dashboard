import type { Chart, ChartConfiguration, Plugin } from 'chart.js';

export interface ActivityPoint {
  label: string;
  created: number;
  updates: number;
}

type Trend = 'line' | 'bar';
const series = [
  { key: 'created', label: 'New leads', stroke: '#66e4cb', fill: '#66e4cb29' },
  { key: 'updates', label: 'First dealer updates', stroke: '#a7bdfd', fill: '#a7bdfd40' },
] as const;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const guide: Plugin<Trend> = {
  id: 'sharedDateGuide',
  beforeDatasetsDraw(chart) {
    const point = chart.getActiveElements()[0];
    if (!point) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#bfd9e582';
    ctx.setLineDash([3, 4]);
    ctx.moveTo(point.element.x, chartArea.top);
    ctx.lineTo(point.element.x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export class ActivityChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly plot: HTMLElement;
  private readonly fallback: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private readonly visible = [true, true];
  private instance?: Chart<Trend, number[], string>;
  private type?: Trend;

  constructor(host: HTMLElement) {
    host.innerHTML = '<div class="activity-legend" hidden>' + series.map(({ label, key }, index) =>
      '<button type="button" class="' + key + '" data-series="' + index + '" aria-pressed="true">' + label + '</button>').join('') +
      '</div><div class="activity-canvas" hidden><canvas role="img" aria-label="New leads and first dealer updates by date. Exact counts are in the table below."></canvas></div>' +
      '<p class="activity-fallback" hidden>Open the table below for exact counts.</p>';
    this.plot = host.querySelector<HTMLElement>('.activity-canvas')!;
    this.fallback = host.querySelector<HTMLElement>('.activity-fallback')!;
    this.controls = host.querySelector<HTMLElement>('.activity-legend')!;
    this.canvas = host.querySelector('canvas')!;
    this.buttons = Array.from(this.controls.querySelectorAll('button'));
    this.buttons.forEach((button, index) => button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      this.visible[index] = !this.visible[index];
      this.instance?.setDatasetVisibility(index, this.visible[index]);
      this.instance?.update();
      this.syncLegend();
    }));
    reduceMotion.addEventListener('change', () => {
      this.instance?.stop();
      if (this.instance) {
        this.instance.options.animation = this.animation();
        this.instance.options.transitions = { active: { animation: { duration: reduceMotion.matches ? 0 : 130 } } };
        this.instance.update('none');
      }
    });
  }

  private animation() {
    return reduceMotion.matches ? false as const : { duration: 420, easing: 'easeOutQuart' as const };
  }

  private syncLegend() {
    const count = this.visible.filter(Boolean).length;
    this.buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(this.visible[index]));
      // Keep the currently selected button keyboard-focusable.
      button.setAttribute('aria-disabled', String(count === 1 && this.visible[index]));
    });
  }

  render(points: readonly ActivityPoint[], grouped = false) {
    const WidgetChart = (window as Window & { Chart?: typeof Chart }).Chart;
    const context = WidgetChart && this.canvas.getContext('2d');
    this.controls.hidden = !context;
    this.plot.hidden = !context;
    this.fallback.hidden = Boolean(context);
    if (!WidgetChart || !context) return;
    const type = points.length < 2 || grouped ? 'bar' : 'line';
    const maximum = Math.max(1, ...points.flatMap(point => [point.created, point.updates]));
    const yMax = maximum * 1.11;
    const labels = points.map(point => point.label);
    const datasets = series.map((set, index) => ({
      label: set.label,
      data: points.map(point => point[set.key]),
      borderColor: set.stroke,
      backgroundColor: type === 'bar' && index === 0 ? set.stroke : set.fill,
      borderWidth: type === 'line' ? 2.5 : 1,
      borderDash: index === 1 ? [5, 4] : [],
      fill: type === 'line' && index === 0,
      tension: 0,
      pointStyle: index === 0 ? 'circle' as const : 'rectRot' as const,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      pointBackgroundColor: set.stroke,
      borderRadius: 4,
      maxBarThickness: 30,
    }));
    if (this.instance && this.type === type) {
      this.instance.data.labels = labels;
      this.instance.data.datasets.forEach((dataset, index) => { dataset.data = datasets[index].data; });
      if (this.instance.options.scales?.y) this.instance.options.scales.y.suggestedMax = yMax;
      this.instance.setActiveElements([]);
      this.instance.tooltip?.setActiveElements([], { x: 0, y: 0 });
      this.instance.update();
      return;
    }
    this.instance?.destroy();
    this.type = type;
    const configuration: ChartConfiguration<Trend, number[], string> = {
      type,
      data: { labels, datasets },
      plugins: [guide],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: this.animation(),
        transitions: { active: { animation: { duration: reduceMotion.matches ? 0 : 130 } } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1a2b', borderColor: '#728ca5', borderWidth: 1, padding: 11,
            usePointStyle: true, displayColors: true, bodyColor: '#f2f7fc', titleColor: '#f2f7fc',
          },
        },
        scales: {
          x: {
            grid: { display: false }, border: { color: '#6b829b' },
            ticks: {
              color: '#c6d5e3', maxRotation: 0, maxTicksLimit: 7, font: { size: 11 },
              callback(value) { return this.getLabelForValue(Number(value)).split(' – ')[0]; },
            },
          },
          y: {
            beginAtZero: true, suggestedMax: yMax, border: { display: false },
            grid: { color: '#384c63' },
            ticks: { color: '#c6d5e3', precision: 0, maxTicksLimit: 5, font: { size: 11 } },
          },
        },
      },
    };
    this.instance = new WidgetChart(context, configuration);
    this.visible.forEach((visible, index) => this.instance?.setDatasetVisibility(index, visible));
    if (this.visible.includes(false)) this.instance.update('none');
    this.syncLegend();
  }
}
