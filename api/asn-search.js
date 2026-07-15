// Simple in-memory cache — persists across invocations while the function stays warm
let asnCache = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

function parseCsvLine(line) {
  // Handles: asn,name,class — where name may be quoted and contain commas
  const m = line.match(/^AS(\d+),(?:"([^"]*)"|([^,]*)),(.*)$/);
  if (!m) return null;
  return { asn: parseInt(m[1], 10), name: (m[2] !== undefined ? m[2] : m[3]) || '', cls: m[4] || '' };
}

async function loadAsnTable() {
  const now = Date.now();
  if (asnCache && (now - cacheTime) < CACHE_TTL) return asnCache;
  const resp = await fetch('https://bgp.tools/asns.csv', {
    headers: { 'User-Agent': 'netquanta-bgp-tool - netconsulting@netquanta.net' }
  });
  if (!resp.ok) throw new Error('ASN table fetch failed (' + resp.status + ')');
  const text = await resp.text();
  const lines = text.split('\n');
  const table = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const row = parseCsvLine(lines[i].trim());
    if (row && row.name) table.push(row);
  }
  asnCache = table;
  cacheTime = now;
  return table;
}

module.exports = async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Provide a search term of at least 2 characters' });
    return;
  }
  try {
    const table = await loadAsnTable();
    const matches = [];
    for (const row of table) {
      if (row.name.toLowerCase().includes(q)) {
        matches.push({ asn: 'AS' + row.asn, name: row.name, type: row.cls });
        if (matches.length >= 25) break;
      }
    }
    res.status(200).json({ query: q, count: matches.length, matches });
  } catch (err) {
    res.status(502).json({ error: 'Search failed: ' + err.message });
  }
};
