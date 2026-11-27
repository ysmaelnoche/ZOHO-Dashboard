import type { Chart } from 'chart.js';
import { summarizeAssignments } from '../data/executive.js';
import { byId, escape } from './common.js';

const countFormat = new Intl.NumberFormat('en-PH');
const percentFormat = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });
const colors = ['#0a6158', '#416aa9', '#746397', '#397b8c', '#304c68', '#8598a5'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const animation = () => reducedMotion.matches ? false as const : { duration: 330, animateRotate: false, animateScale: true };

export class AssignmentMix {
  private readonly panel = byId('exec-assignments');
  private readonly canvas = this.panel.querySelector('canvas')!;
  private chart?: Chart<'doughnut', number[], string>;
  private total = 0;

  constructor() {
    reducedMotion.addEventListener('change', () => {
      if (!this.chart) return;
      this.chart.stop();
      this.chart.options.animation = animation();
      this.chart.update('none');
    });
  }

  render(assignments: Parameters<typeof summarizeAssignments>[0]) {
    const { total, slices } = summarizeAssignments(assignments);
    this.total = total;
    this.panel.hidden = total === 0;
    if (!total) {
      this.chart?.destroy();
      this.chart = undefined;
      byId('assignment-total').textContent = '';
      byId('assignment-legend').replaceChildren();
      return;
    }
    byId('assignment-total').textContent = countFormat.format(total);
    byId('assignment-legend').innerHTML = slices.map(({ label, count }, index) =>
      '<li><span class="assignment-dot" aria-hidden="true" style="--slice:' + colors[index] + '"></span>' +
      '<span class="assignment-name">' + escape(label) + '</span><strong>' + countFormat.format(count) +
      '</strong><span class="assignment-share">' + percentFormat.format(count / total) + '</span></li>').join('');

    const WidgetChart = (window as Window & { Chart?: typeof Chart }).Chart;
    const context = WidgetChart && this.canvas.getContext('2d');
    this.canvas.hidden = !context;
    if (!WidgetChart || !context) return;

    const labels = slices.map(slice => slice.label);
    const data = slices.map(slice => slice.count);
    if (this.chart) {
      const sameLabels = this.chart.data.labels?.length === labels.length &&
        this.chart.data.labels.every((label, index) => label === labels[index]);
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.chart.setActiveElements([]);
      this.chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      this.chart.update(sameLabels ? undefined : 'none');
      return;
    }
    this.chart = new WidgetChart(context, {
      type: 'doughnut',
      data: { labels, datasets: [{
        data, backgroundColor: colors, borderColor: '#f9fcfc', borderWidth: 2, hoverOffset: 3,
      }] },
      options: {
        cutout: '75%', responsive: true, maintainAspectRatio: false, animation: animation(),
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => ' ' + countFormat.format(item.parsed) +
            (item.parsed === 1 ? ' lead · ' : ' leads · ') + percentFormat.format(item.parsed / this.total) } },
        },
      },
    });
  }
}
