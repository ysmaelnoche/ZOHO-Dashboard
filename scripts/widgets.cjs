const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, dirname, join, resolve } = require('node:path');

const project = resolve(__dirname, '..');
const editions = {
  daily: { name: 'TVS-PH-Daily-Operations', modules: ['js/data/dashboard.js', 'js/ui/dashboard.js'] },
  executive: { name: 'TVS-PH-Executive-Overview', modules: ['js/data/executive.js', 'js/ui/executive.js', 'js/ui/assignment-mix.js'] },
};
const sharedAssets = [
  'styles/dashboard.css', 'styles/executive.css',
  'assets/chart.js', 'assets/chart-license.txt', 'assets/chart-color-license.txt',
  'assets/manrope.woff2', 'assets/manrope-extended.woff2', 'assets/manrope-license.txt',
  'js/main.js', 'js/config.js', 'js/zoho.js', 'js/live-settings.js',
  'js/data/zoho.js', 'js/data/manila.js', 'js/data/mock.js',
  'js/ui/activity-chart.js', 'js/ui/common.js',
];

function widgetHtml(edition) {
  const source = readFileSync(join(project, 'app/widget.html'), 'utf8');
  const html = source
    .replace(/^[\t ]*<!-- widget:(daily|executive|both) -->\r?\n([\s\S]*?)^[\t ]*<!-- \/widget:\1 -->\r?\n/gm,
      (_, region, markup) => region === edition ? markup : '')
    .replace('<body class="handoff-board">', '<body class="handoff-board" data-edition="' + edition + '">');
  if (/<!-- \/?widget:/.test(html) || !html.includes('id="' + edition + '-navigation"') ||
      !html.includes('id="' + edition + '-skeleton"') || !html.includes('data-edition="' + edition + '"') ||
      /id="switch-view"/.test(html)) throw new Error('Widget layout could not be split for ' + edition);
  if (edition === 'daily') return html;
  return html
    .replace('TVS PH | CRM handoff board', 'TVS PH | Executive Overview')
    .replace('id="workspace-title">Daily Operations', 'id="workspace-title">Executive Overview')
    .replace('id="dashboard-title" tabindex="-1">CRM handoff board',
      'id="dashboard-title" tabindex="-1">Philippine sales &amp; dealer performance')
    .replace('id="period-label">New leads from', 'id="period-label">Reporting period')
    .replace('id="executive-navigation" aria-label="Executive sections" hidden', 'id="executive-navigation" aria-label="Executive sections"');
}

function createStagingArea() {
  const temp = realpathSync(tmpdir());
  const workspace = mkdtempSync(join(temp, 'tvs-ph-widgets-'));
  return {
    stage(edition) {
      if (!Object.hasOwn(editions, edition)) throw new Error('Unknown widget edition');
      const { name, modules } = editions[edition];
      const root = join(workspace, name);
      const app = join(root, 'app');
      mkdirSync(app, { recursive: true });
      for (const asset of [...sharedAssets, ...modules]) {
        const target = join(app, asset);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(project, 'app', asset), target);
      }
      writeFileSync(join(app, 'widget.html'), widgetHtml(edition));
      copyFileSync(join(project, 'plugin-manifest.json'), join(root, 'plugin-manifest.json'));
      return root;
    },
    dispose() {
      const target = realpathSync(workspace);
      if (dirname(target) !== temp || !basename(target).startsWith('tvs-ph-widgets-')) {
        throw new Error('Refusing to remove a directory outside the widget staging area.');
      }
      rmSync(target, { force: true, recursive: true });
    },
  };
}

function runZet(command, root) {
  const result = spawnSync(process.execPath, [join(__dirname, 'zet.cjs'), command, root], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('ZET ' + command + ' failed for ' + basename(root));
}

function run(command, edition) {
  if (command !== 'validate' && command !== 'pack') throw new Error('Use validate or pack');
  const staging = createStagingArea();
  try {
    const targets = edition ? [edition] : Object.keys(editions);
    const staged = targets.map(target => staging.stage(target));
    for (const root of staged) {
      console.log('Validating ' + basename(root));
      runZet('validate', root);
    }
    if (command === 'pack') {
      const archives = staged.map(root => {
        runZet('pack', root);
        const file = basename(root) + '.zip';
        const path = join(root, 'dist', file);
        if (statSync(path).size === 0) throw new Error('ZET produced an empty ZIP for ' + file);
        return { file, path };
      });
      const dist = join(project, 'dist');
      mkdirSync(dist, { recursive: true });
      for (const { path, file } of archives) {
        copyFileSync(path, join(dist, file));
        console.log('Ready: dist/' + file);
      }
    }
  } finally {
    staging.dispose();
  }
}

module.exports = { createStagingArea };
if (require.main === module) run(process.argv[2], process.argv[3]);
