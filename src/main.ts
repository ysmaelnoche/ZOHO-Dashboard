import { environment } from './config.js';
import type { LeadSnapshot } from './data/dashboard.js';
import { createZohoAdapter } from './data/zoho.js';
import { centralCrmView, liveSettings } from './live-settings.js';
import { byId, when } from './ui/common.js';
import { initializeZoho } from './zoho.js';

const refresh = byId<HTMLButtonElement>('refresh');
const filters = byId<HTMLFormElement>('filters');
const period = byId<HTMLSelectElement>('period');
const source = byId<HTMLSelectElement>('source');
const skeleton = byId('loading-skeleton');
const message = byId('message');
const banner = byId('environment');
const updated = byId('updated');
const progress = byId<HTMLProgressElement>('read-progress');
const retry = byId<HTMLButtonElement>('retry');
const readError = byId<HTMLDetailsElement>('read-error');
const errorMessage = byId('error-message');
const isDemo = environment === 'mock';
const switchView = document.querySelector<HTMLAnchorElement>('#switch-view');
const detail = document.querySelector<HTMLDialogElement>('#detail');

let snapshot: LeadSnapshot | undefined;
let openLead: ((id: string) => Promise<boolean>) | undefined;
let loading = false;

interface Pane {
  content: HTMLElement;
  skeleton: HTMLElement;
  navigation: HTMLElement;
  links: HTMLAnchorElement[];
  selection?: string;
  render(snapshot: LeadSnapshot, days: number): void;
}

function createPane(kind: 'daily' | 'executive', content: string, render: Pane['render']): Pane {
  const navigation = byId(kind + '-navigation');
  return { content: byId(content), skeleton: byId(kind + '-skeleton'), navigation,
    links: Array.from(navigation.querySelectorAll('a')), render };
}

async function loadDailyPane() {
  const [{ Board }, { summarize }] = await Promise.all([import('./ui/dashboard.js'), import('./data/dashboard.js')]);
  const board = new Board();
  return createPane('daily', 'content', ({ leads, policy, asOf }, days) =>
    board.render(summarize(leads, policy, asOf, days), asOf, leads, openLead));
}

async function loadExecutivePane() {
  const [{ ExecutiveOverview }, { summarizeExecutive }] = await Promise.all([
    import('./ui/executive.js'), import('./data/executive.js'),
  ]);
  const board = new ExecutiveOverview();
  return createPane('executive', 'executive-content', ({ leads, policy, asOf }, days) =>
    board.render(summarizeExecutive(leads, policy, asOf, days)));
}

const edition = document.body.dataset.edition;
const [dailyPane, executivePane] = await Promise.all([
  edition === 'executive' ? undefined : loadDailyPane(),
  edition === 'daily' ? undefined : loadExecutivePane(),
]);
const panes = [dailyPane, executivePane].filter(pane => pane !== undefined);
let active = panes[0];

const sourceOption = (value: string | null) => value === null ? 'missing' : 'value:' + value;

function syncSkeleton() {
  skeleton.hidden = !loading;
  for (const pane of panes) pane.skeleton.hidden = pane !== active;
}

function configureSourceFilter(current: LeadSnapshot) {
  const previous = source.value;
  const values = new Set(current.leads.map(lead => lead.source));
  const recorded = [...values].filter((value): value is string => value !== null).sort((a, b) => a.localeCompare(b));
  const options = [new Option('All sources', ''), ...recorded.map(value => new Option(value, sourceOption(value)))];
  if (values.has(null)) options.push(new Option('Not recorded', sourceOption(null)));
  source.replaceChildren(...options);
  source.value = options.some(option => option.value === previous) ? previous : '';
  source.disabled = options.length === 1;
}

function render() {
  if (!snapshot) return;
  const current = snapshot;
  for (const pane of panes) pane.content.hidden = pane !== active;
  const selection = period.value + ':' + source.value;
  if (selection !== active.selection) {
    const leads = source.value === '' ? current.leads : current.leads.filter(lead => sourceOption(lead.source) === source.value);
    active.render({ ...current, leads }, Number(period.value));
    active.selection = selection;
  }
  const time = document.createElement('time');
  time.dateTime = new Date(current.asOf).toISOString();
  time.textContent = when(current.asOf);
  updated.replaceChildren('As of ', time);
  updated.hidden = false;
}

async function load() {
  if (environment === 'inactive' || loading) return;
  loading = true;
  refresh.disabled = true;
  source.disabled = true;
  filters.setAttribute('aria-busy', 'true');
  message.textContent = isDemo ? 'Loading demo data…' : 'Loading ' + centralCrmView.name + '…';
  progress.hidden = false;
  retry.hidden = true;
  readError.hidden = true;
  readError.open = false;
  errorMessage.textContent = '';
  snapshot = undefined;
  for (const pane of panes) {
    pane.selection = undefined;
    pane.content.hidden = true;
  }
  syncSkeleton();
  updated.hidden = true;
  detail?.close();
  try {
    if (isDemo) {
      const { mockAdapter } = await import('./data/mock.js');
      snapshot = await mockAdapter.load();
    } else {
      const { sdk, zrc } = await initializeZoho();
      snapshot = await createZohoAdapter((path, options) => zrc.get(path, options), liveSettings).load();
      if (dailyPane && sdk.CRM?.UI?.Record?.open) {
        const record = sdk.CRM.UI.Record;
        openLead = id => record.open({ Entity: 'Leads', RecordID: id });
      }
    }
    configureSourceFilter(snapshot);
    render();
    message.textContent = isDemo ? 'Synthetic data loaded.' :
      snapshot.leads.length === 0 ? 'No leads in ' + centralCrmView.name + ' are visible to this user.' :
      snapshot.leads.length + (snapshot.leads.length === 1 ? ' lead loaded' : ' leads loaded');
  } catch (error) {
    snapshot = undefined;
    for (const pane of panes) pane.content.hidden = true;
    source.replaceChildren(new Option('All sources', ''));
    source.disabled = true;
    message.textContent = isDemo ? 'Could not load demo leads. Try again.' : 'Could not load leads from Zoho CRM. Try again.';
    if (error instanceof Error && error.message) {
      errorMessage.textContent = error.message;
      readError.hidden = false;
    }
    retry.hidden = false;
  } finally {
    progress.hidden = true;
    filters.removeAttribute('aria-busy');
    refresh.disabled = false;
    loading = false;
    syncSkeleton();
  }
}

filters.addEventListener('submit', event => event.preventDefault());
filters.addEventListener('change', render);
refresh.addEventListener('click', () => void load());
retry.addEventListener('click', () => void load());

function syncView() {
  const previous = active;
  active = panes.find(pane => pane.links.some(link => link.hash === location.hash)) ?? panes[0];
  const executive = active === executivePane;
  const current = active.links.find(link => link.hash === location.hash) ?? active.links[0];
  for (const pane of panes) {
    pane.navigation.hidden = pane !== active;
    for (const link of pane.links) {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  if (switchView) {
    switchView.textContent = executive ? 'Daily Operations' : 'Executive Overview';
    switchView.href = executive ? '#overview' : '#executive';
  }
  byId('workspace-title').textContent = executive ? 'Executive Overview' : 'Daily Operations';
  const title = byId('dashboard-title');
  title.textContent = executive ? 'Philippine sales & dealer performance' : 'CRM handoff board';
  byId('period-label').textContent = executive ? 'Reporting period' : 'New leads from';
  if (active !== previous) {
    syncSkeleton();
    detail?.close();
    render();
    if (snapshot && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const view = active.content;
      for (const animation of view.getAnimations()) animation.cancel();
      view.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    }
  }
}

window.addEventListener('hashchange', () => {
  syncView();
  if (location.hash === '#executive' || location.hash === '#overview') {
    byId('dashboard-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else if (location.hash) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }
});
syncView();

if (environment !== 'inactive') {
  banner.textContent = isDemo ? 'DEMO DATA' : 'LIVE · READ ONLY';
  banner.hidden = false;
  void load();
} else {
  filters.hidden = true;
  message.textContent = 'Open the widget in Zoho CRM or start the local synthetic preview.';
}
