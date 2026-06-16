const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4873;

const server = http.createServer((req, res) => {
  console.log(`[Registry] Request: ${req.method} ${req.url}`);

  if (req.url === '/create-pw-core') {
    const pkg = require('../create-pw-core/package.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'create-pw-core',
      versions: {
        [pkg.version]: {
          name: 'create-pw-core',
          version: pkg.version,
          bin: { 'create-pw-core': './dist/index.js' },
          dist: {
            tarball: `http://localhost:${PORT}/create-pw-core-${pkg.version}.tgz`
          }
        }
      },
      'dist-tags': {
        latest: pkg.version
      }
    }));
    return;
  }

  if (req.url === '/pw-core') {
    const pkg = require('../package.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'pw-core',
      versions: {
        [pkg.version]: {
          name: 'pw-core',
          version: pkg.version,
          dist: {
            tarball: `http://localhost:${PORT}/pw-core-${pkg.version}.tgz`
          }
        }
      },
      'dist-tags': {
        latest: pkg.version
      }
    }));
    return;
  }

  if (req.url.startsWith('/create-pw-core-') && req.url.endsWith('.tgz')) {
    const filename = req.url.substring(1);
    const tarballPath = path.join(__dirname, '../create-pw-core', filename);
    if (fs.existsSync(tarballPath)) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(tarballPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Tarball not found');
    }
    return;
  }

  if (req.url.startsWith('/pw-core-') && req.url.endsWith('.tgz')) {
    const filename = req.url.substring(1);
    const tarballPath = path.join(__dirname, '..', filename);
    if (fs.existsSync(tarballPath)) {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(tarballPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Tarball not found');
    }
    return;
  }

  // Fallback to proxying to npmjs registry if any other requests occur (like dependencies)
  const headers = { ...req.headers };
  headers.host = 'registry.npmjs.org';
  
  const proxyReq = https.request({
    hostname: 'registry.npmjs.org',
    port: 443,
    path: req.url,
    method: req.method,
    headers: headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxyReq);
  proxyReq.on('error', (err) => {
    console.error('[Registry] Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });
});

server.listen(PORT, () => {
  console.log(`[Registry] Local registry running at http://localhost:${PORT}/`);
  console.log(`[Registry] You can run: npm init pw-core --registry=http://localhost:${PORT}`);
});
