const ABBR = {
  'Royal Challengers Bengaluru': 'RCB', 'Royal Challengers Bangalore': 'RCB',
  'Sunrisers Hyderabad': 'SRH', 'Gujarat Titans': 'GT',
  'Punjab Kings': 'PBKS', 'Chennai Super Kings': 'CSK',
  'Rajasthan Royals': 'RR', 'Delhi Capitals': 'DC',
  'Kolkata Knight Riders': 'KKR', 'Mumbai Indians': 'MI',
  'Lucknow Super Giants': 'LSG',
};
const VALID = new Set(['RCB','SRH','GT','PBKS','CSK','RR','DC','KKR','MI','LSG']);

function normalise(rows) {
  return rows.map(row => {
    const name = ABBR[row.TeamName] || ABBR[row.teamName] || row.TeamSName || row.teamSName || row.name;
    return {
      name,
      m:   +(row.Matches   || row.matches   || row.m)  || 0,
      w:   +(row.Won       || row.won       || row.w)  || 0,
      l:   +(row.Lost      || row.lost      || row.l)  || 0,
      nr:  +(row.NoResult  || row.noResult  || row.nr) || 0,
      pts: +(row.Points    || row.points    || row.pts)|| 0,
      nrr: +(row.NetRunRate|| row.netRunRate|| row.nrr)|| 0,
    };
  }).filter(t => VALID.has(t.name));
}

// ── Source 1: IPL official S3 JSONP ──────────────────────────────────────────
async function tryIPLJsonp() {
  const urls = [
    'https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/stats/2026/pointstable.js',
    'https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/2026/pointstable.js',
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const text = await r.text();
      // Strip JSONP wrapper e.g. PointsTableCallback({...})
      const m = text.match(/[A-Za-z_$][\w$]*\s*\(([\s\S]+)\)\s*;?\s*$/);
      if (!m) continue;
      const data = JSON.parse(m[1]);
      const rows = data?.PointsTable?.PointsTableData || data?.pointsTable || [];
      const standings = normalise(rows);
      if (standings.length === 10) return standings;
    } catch (_) {}
  }
  return null;
}

// ── Source 2: Cricbuzz HTML → Claude Haiku for extraction ─────────────────────
async function tryCricbuzz(apiKey) {
  const r = await fetch(
    'https://www.cricbuzz.com/cricket-series/9241/indian-premier-league-2026/points-table',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!r.ok) throw new Error(`Cricbuzz HTTP ${r.status}`);
  const html = await r.text();

  // Pull the most relevant chunk (first 12 kB of body)
  const bodyIdx = html.indexOf('<body');
  const chunk = html.slice(bodyIdx > 0 ? bodyIdx : 0, (bodyIdx > 0 ? bodyIdx : 0) + 12000);

  const up = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content:
          `Extract the IPL 2026 points table from this HTML. ` +
          `Return ONLY raw JSON, no markdown:\n` +
          `{"standings":[{"name":"RCB","m":12,"w":8,"l":4,"nr":0,"pts":16,"nrr":1.053}]}\n` +
          `All 10 teams: RCB SRH GT PBKS CSK RR DC KKR MI LSG.\n\nHTML:\n${chunk}`,
      }],
    }),
  });
  const data = await up.json();
  if (!up.ok) throw new Error(data?.error?.message || 'Haiku error');

  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const match = txt.replace(/```(?:json)?\n?/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Haiku returned: ${txt.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  const standings = normalise(parsed.standings || []);
  if (standings.length !== 10) throw new Error(`Got ${standings.length} teams from Haiku`);
  return standings;
}

// ── Source 3: iplt20.com HTML → Claude Haiku ─────────────────────────────────
async function tryIPLT20(apiKey) {
  const r = await fetch('https://www.iplt20.com/matches/points-table', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`iplt20 HTTP ${r.status}`);
  const html = await r.text();
  const bodyIdx = html.indexOf('<body');
  const chunk = html.slice(bodyIdx > 0 ? bodyIdx : 0, (bodyIdx > 0 ? bodyIdx : 0) + 12000);

  const up = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content:
          `Extract the IPL 2026 points table from this HTML. ` +
          `Return ONLY raw JSON, no markdown:\n` +
          `{"standings":[{"name":"RCB","m":12,"w":8,"l":4,"nr":0,"pts":16,"nrr":1.053}]}\n` +
          `All 10 teams: RCB SRH GT PBKS CSK RR DC KKR MI LSG.\n\nHTML:\n${chunk}`,
      }],
    }),
  });
  const data = await up.json();
  if (!up.ok) throw new Error(data?.error?.message || 'Haiku error');

  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const match = txt.replace(/```(?:json)?\n?/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Haiku returned: ${txt.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  const standings = normalise(parsed.standings || []);
  if (standings.length !== 10) throw new Error(`Got ${standings.length} teams`);
  return standings;
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const errors = [];

  // 1. IPL official JSONP (free, no AI)
  try {
    const standings = await tryIPLJsonp();
    if (standings && standings.length === 10)
      return res.status(200).json({ standings, source: 'ipl-s3' });
    errors.push('ipl-s3: no data');
  } catch (e) { errors.push(`ipl-s3: ${e.message}`); }

  // 2. Cricbuzz HTML + Haiku
  try {
    const standings = await tryCricbuzz(apiKey);
    if (standings && standings.length === 10)
      return res.status(200).json({ standings, source: 'cricbuzz' });
    errors.push('cricbuzz: no data');
  } catch (e) { errors.push(`cricbuzz: ${e.message}`); }

  // 3. iplt20.com HTML + Haiku
  try {
    const standings = await tryIPLT20(apiKey);
    if (standings && standings.length === 10)
      return res.status(200).json({ standings, source: 'iplt20' });
    errors.push('iplt20: no data');
  } catch (e) { errors.push(`iplt20: ${e.message}`); }

  return res.status(502).json({ error: `All sources failed — ${errors.join(' | ')}` });
};
