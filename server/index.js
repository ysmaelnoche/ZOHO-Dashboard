const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');

const project = resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

function createPreviewServer() {
  return createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.writeHead(302, { Location: '/app/widget.html' }).end();
      return;
    }
    const allowed = pathname === '/plugin-manifest.json' || /^\/app\/(?:[\w-]+\/)*[\w-]+\.(html|css|js|json)$/.test(pathname);
    if (!allowed) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(resolve(project, '.' + pathname));
      response.writeHead(200, { 'Content-Type': types[extname(pathname)], 'Cache-Control': 'no-store' }).end(content);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
}

module.exports = { createPreviewServer };

if (require.main === module || module.parent?.filename.includes('zoho-extension-toolkit')) {
  createPreviewServer().listen(5000, '127.0.0.1', () => {
    console.log('Local widget preview at http://127.0.0.1:5000/app/widget.html');
  });
}
