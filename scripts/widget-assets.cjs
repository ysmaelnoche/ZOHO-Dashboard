const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const dependencies = resolve(root, 'node_modules');
const output = resolve(root, 'app', 'assets');
mkdirSync(output, { recursive: true });

const chart = readFileSync(resolve(dependencies, 'chart.js/dist/chart.umd.min.js'), 'utf8');
writeFileSync(resolve(output, 'chart.js'), chart.replace(/\r?\n\/\/# sourceMappingURL=.*\s*$/, '\n'));

for (const [source, target] of [
  ['chart.js/LICENSE.md', 'chart-license.txt'],
  ['@kurkle/color/LICENSE', 'chart-color-license.txt'],
  ['@fontsource-variable/manrope/LICENSE', 'manrope-license.txt'],
  ['@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', 'manrope.woff2'],
  ['@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2', 'manrope-extended.woff2'],
]) {
  copyFileSync(resolve(dependencies, source), resolve(output, target));
}
