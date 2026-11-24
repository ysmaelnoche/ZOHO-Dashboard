const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.md': 'text/plain; charset=utf-8',
};
function createPreview() {
  return createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    const type = types[extname(file)];
    if (!type || !/^(?:screenshots\/)?[a-z0-9._-]+$/i.test(file)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(resolve(__dirname, file));
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
}

module.exports = { createPreview };
if (require.main === module) {
  createPreview().listen(5070, '127.0.0.1', () => console.log('http://127.0.0.1:5070/'));
}
