module.exports = async (req, res) => {
  const mac = (req.query.mac || '').trim();
  if (!mac) {
    res.status(400).json({ error: 'Missing mac parameter' });
    return;
  }
  try {
    const resp = await fetch('https://api.macvendors.com/' + encodeURIComponent(mac));
    if (resp.status === 404) {
      res.status(200).json({ vendor: null, message: 'Not found in registry' });
      return;
    }
    if (!resp.ok) {
      res.status(resp.status).json({ error: 'Upstream lookup failed (' + resp.status + ')' });
      return;
    }
    const vendor = await resp.text();
    res.status(200).json({ vendor });
  } catch (err) {
    res.status(502).json({ error: 'Lookup failed: ' + err.message });
  }
};
