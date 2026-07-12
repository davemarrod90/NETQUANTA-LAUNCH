module.exports = async (req, res) => {
  const host = (req.query.host || '').trim();
  const type = (req.query.type || 'A').trim();
  if (!host) {
    res.status(400).json({ error: 'Missing host parameter' });
    return;
  }
  try {
    const resp = await fetch(
      'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=' + encodeURIComponent(type),
      { headers: { accept: 'application/dns-json' } }
    );
    if (!resp.ok) {
      res.status(resp.status).json({ error: 'Upstream query failed (' + resp.status + ')' });
      return;
    }
    const data = await resp.json();
    res.status(200).json({ answers: data.Answer || [] });
  } catch (err) {
    res.status(502).json({ error: 'Query failed: ' + err.message });
  }
};
