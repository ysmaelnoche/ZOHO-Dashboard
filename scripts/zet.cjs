const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const command = process.argv[2];
if (!['run', 'validate', 'pack'].includes(command)) throw new Error('Unsupported local ZET command');
const state = resolve('.zet-state');
mkdirSync(state, { recursive: true });
const result = spawnSync(process.execPath, [require.resolve('zoho-extension-toolkit'), command], {
  stdio: 'inherit',
  env: { ...process.env, APPDATA: state, XDG_CONFIG_HOME: state, XDG_DATA_HOME: state, NO_UPDATE_NOTIFIER: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
