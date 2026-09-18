const crypto = require('crypto');

// Vercel serverless functions cap request/response bodies (~4.5MB).
// Stay comfortably under it.
const MAX_CHUNK = 4000000;

function consumeStream(req) {
  return new Promise(function (resolve, reject) {
    let total = 0;
    req.on('data', function (c) { total += c.length; });
    req.on('end', function () { resolve(total); });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  const type = (req.query && req.query.type) || 'ping';

  // No caching anywhere. A cached response would measure the browser
  // cache instead of the network.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Timing-Allow-Origin', '*');

  // ---- latency probe: smallest possible response ----
  if (type === 'ping') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('p');
    return;
  }

  // ---- download: random (incompressible) bytes ----
  if (type === 'download') {
    let bytes = parseInt((req.query && req.query.bytes) || '2000000', 10);
    if (isNaN(bytes) || bytes <= 0) bytes = 2000000;
    if (bytes > MAX_CHUNK) bytes = MAX_CHUNK;

    // Random data matters: a zero-filled buffer compresses to almost
    // nothing, which would measure gzip throughput rather than the network.
    const buf = Buffer.allocUnsafe(bytes);
    crypto.randomFillSync(buf);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(bytes));
    res.status(200).send(buf);
    return;
  }

  // ---- upload: swallow the body, report what arrived ----
  if (type === 'upload') {
    try {
      let received;
      if (req.body && (Buffer.isBuffer(req.body) || typeof req.body.byteLength === 'number')) {
        received = Buffer.isBuffer(req.body) ? req.body.length : req.body.byteLength;
      } else {
        received = await consumeStream(req);
      }
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({ received: received });
    } catch (err) {
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
    return;
  }

  res.status(400).json({ error: 'Unknown test type' });
};
