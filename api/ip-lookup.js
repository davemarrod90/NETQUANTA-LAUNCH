module.exports = async (req, res) => {
  let ip = (req.query.ip || '').trim();
  if (!ip) {
    const fwd = req.headers['x-forwarded-for'];
    ip = fwd ? fwd.split(',')[0].trim() : '';
  }
  try {
    const url = ip ? 'https://ipwho.is/' + encodeURIComponent(ip) : 'https://ipwho.is/';
    const resp = await fetch(url);
    if (!resp.ok) {
      res.status(resp.status).json({ error: 'Upstream lookup failed (' + resp.status + ')' });
      return;
    }
    const data = await resp.json();
    if (!data.success) {
      res.status(200).json({ error: data.message || 'Lookup failed' });
      return;
    }
    res.status(200).json({
      ip: data.ip,
      isp: data.connection?.isp || null,
      org: data.connection?.org || null,
      asn: data.connection?.asn ? 'AS' + data.connection.asn : null,
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      timezone: data.timezone?.id || null
    });
  } catch (err) {
    res.status(502).json({ error: 'Lookup failed: ' + err.message });
  }
};
