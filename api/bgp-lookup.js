function isAsn(input) {
  return /^(AS)?\d+$/i.test(input.trim());
}
function isIpOrPrefix(input) {
  const v = input.trim();
  return /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(v) || /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(v) && v.includes(':');
}

module.exports = async (req, res) => {
  const resource = (req.query.resource || '').trim();
  if (!resource) {
    res.status(400).json({ error: 'Missing resource parameter' });
    return;
  }

  try {
    if (isAsn(resource)) {
      const asn = resource.toUpperCase().startsWith('AS') ? resource.toUpperCase() : 'AS' + resource;
      const [overviewResp, prefixesResp] = await Promise.all([
        fetch('https://stat.ripe.net/data/as-overview/data.json?resource=' + encodeURIComponent(asn) + '&sourceapp=netquanta-bgp-tool'),
        fetch('https://stat.ripe.net/data/announced-prefixes/data.json?resource=' + encodeURIComponent(asn) + '&sourceapp=netquanta-bgp-tool')
      ]);
      const overview = await overviewResp.json();
      const prefixesData = await prefixesResp.json();

      if (!overview.data) {
        res.status(200).json({ error: 'No data found for ' + asn });
        return;
      }

      const prefixes = (prefixesData.data && prefixesData.data.prefixes) || [];

      res.status(200).json({
        type: 'asn',
        asn: asn,
        holder: overview.data.holder || null,
        announced: overview.data.announced,
        prefixCount: prefixes.length,
        samplePrefixes: prefixes.slice(0, 15).map(p => p.prefix)
      });
      return;
    }

    if (isIpOrPrefix(resource)) {
      const [overviewResp, routingResp, glassResp] = await Promise.all([
        fetch('https://stat.ripe.net/data/prefix-overview/data.json?resource=' + encodeURIComponent(resource) + '&sourceapp=netquanta-bgp-tool'),
        fetch('https://stat.ripe.net/data/routing-status/data.json?resource=' + encodeURIComponent(resource) + '&sourceapp=netquanta-bgp-tool'),
        fetch('https://stat.ripe.net/data/looking-glass/data.json?resource=' + encodeURIComponent(resource) + '&sourceapp=netquanta-bgp-tool')
      ]);
      const overview = await overviewResp.json();
      const routing = await routingResp.json();
      const glass = await glassResp.json();

      if (!overview.data) {
        res.status(200).json({ error: 'No routing data found for ' + resource });
        return;
      }

      const asns = (overview.data.asns || []).map(a => ({ asn: a.asn, holder: a.holder }));

      // Pull a handful of unique AS paths from the looking-glass RIS data
      const paths = [];
      const seen = new Set();
      if (glass.data && glass.data.rrcs) {
        for (const rrc of glass.data.rrcs) {
          for (const peer of (rrc.peers || [])) {
            const pathStr = peer.as_path;
            if (pathStr && !seen.has(pathStr)) {
              seen.add(pathStr);
              paths.push({ location: rrc.location, origin: peer.origin, asPath: pathStr, prefix: peer.prefix });
            }
            if (paths.length >= 8) break;
          }
          if (paths.length >= 8) break;
        }
      }

      res.status(200).json({
        type: 'prefix',
        resource: overview.data.resource || resource,
        holders: asns,
        announced: overview.data.announced,
        isLessSpecific: overview.data.is_less_specific,
        visibility: routing.data ? routing.data.visibility : null,
        firstSeen: routing.data ? routing.data.first_seen : null,
        lastSeen: routing.data ? routing.data.last_seen : null,
        paths: paths
      });
      return;
    }

    res.status(400).json({ error: 'Enter a valid IP, CIDR prefix (e.g. 8.8.8.0/24), or ASN (e.g. AS15169)' });
  } catch (err) {
    res.status(502).json({ error: 'Lookup failed: ' + err.message });
  }
};
