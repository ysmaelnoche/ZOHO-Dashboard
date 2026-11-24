import { environment } from './config.js';
import { mockAdapter } from './data/mock.js';
import { byId, renderDashboard } from './ui/dashboard.js';
import { initializeZoho } from './zoho.js';

const refresh = document.querySelector<HTMLButtonElement>('#refresh');
if (!refresh) throw new Error('Missing refresh button');
const content = byId('content');
const message = byId('message');
const banner = byId('environment');

async function load(button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  message.hidden = false;
  message.textContent = 'Loading dashboard…';
  try {
    renderDashboard(await mockAdapter.load());
    content.hidden = false;
    message.textContent = 'Synthetic data loaded.';
  } catch {
    message.textContent = 'Dashboard could not load. Select Refresh to retry.';
  } finally {
    button.disabled = false;
  }
}

if (environment === 'mock') {
  banner.textContent = 'Synthetic data · Local preview only';
  refresh.addEventListener('click', () => void load(refresh));
  void load(refresh);
} else if (environment === 'zoho') {
  banner.textContent = 'Zoho CRM · Data access disabled';
  message.textContent = 'Connecting to the widget host…';
  void initializeZoho().then(
    () => { message.textContent = 'Live dashboard data is disabled pending CRM metadata and access verification.'; },
    () => { message.textContent = 'CRM widget initialization failed. Reload the widget and try again.'; },
  );
} else {
  banner.textContent = 'Widget preview unavailable';
  message.textContent = 'Start the local preview server or open the widget from its Zoho CRM host.';
}
