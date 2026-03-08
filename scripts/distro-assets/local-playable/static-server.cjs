const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const port = Number.parseInt(process.env.STATIC_PORT || '5173', 10);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`STATIC_PORT must be positive integer, got ${process.env.STATIC_PORT}`);
}

const httpsPortRaw = process.env.STATIC_HTTPS_PORT || '';
const httpsPort =
  httpsPortRaw.trim().length === 0 ? null : Number.parseInt(httpsPortRaw, 10);
if (httpsPort !== null && (!Number.isInteger(httpsPort) || httpsPort <= 0)) {
  throw new Error(`STATIC_HTTPS_PORT must be positive integer, got ${process.env.STATIC_HTTPS_PORT}`);
}

const httpsPfxPath = process.env.STATIC_HTTPS_PFX_PATH || '';
const httpsPfxPassword = process.env.STATIC_HTTPS_PFX_PASSWORD || '';
if (httpsPort !== null && (httpsPfxPath.trim().length === 0 || httpsPfxPassword.trim().length === 0)) {
  throw new Error('STATIC_HTTPS_PFX_PATH and STATIC_HTTPS_PFX_PASSWORD are required when STATIC_HTTPS_PORT is set.');
}

const rootDir = path.resolve(__dirname, 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function resolvePath(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0]);
  const relative = clean === '/' ? '/index.html' : clean;
  const candidate = path.resolve(rootDir, `.${relative}`);
  if (!candidate.startsWith(rootDir)) {
    throw new Error('Path traversal blocked.');
  }

  return candidate;
}

const server = http.createServer((req, res) => {
  try {
    const requested = resolvePath(req.url || '/');
    let filePath = requested;

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(rootDir, 'index.html');
    }

    const data = fs.readFileSync(filePath);
    res.statusCode = 200;
    res.setHeader('content-type', contentType(filePath));
    res.end(data);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(error instanceof Error ? error.message : 'Static server error.');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`static-server listening on :${port}`);
});

if (httpsPort !== null) {
  const httpsServer = https.createServer(
    {
      pfx: fs.readFileSync(path.resolve(httpsPfxPath)),
      passphrase: httpsPfxPassword
    },
    (req, res) => {
      try {
        const requested = resolvePath(req.url || '/');
        let filePath = requested;

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(rootDir, 'index.html');
        }

        const data = fs.readFileSync(filePath);
        res.statusCode = 200;
        res.setHeader('content-type', contentType(filePath));
        res.end(data);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end(error instanceof Error ? error.message : 'Static server error.');
      }
    }
  );

  httpsServer.listen(httpsPort, '0.0.0.0', () => {
    console.log(`static-server https listening on :${httpsPort}`);
  });
}
