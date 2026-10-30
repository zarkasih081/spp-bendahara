import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const root = process.cwd();

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(root, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let contentType = 'text/html';
    if (filePath.endsWith('.js')) contentType = 'application/javascript';
    else if (filePath.endsWith('.css')) contentType = 'text/css';
    else if (filePath.endsWith('.png')) contentType = 'image/png';
    else if (filePath.endsWith('.json')) contentType = 'application/json';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(root, 'index.html')).pipe(res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
