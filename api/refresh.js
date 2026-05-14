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
  return (rows || []).map(row => ({
    name: ABBR[row.name] || row.name,
    m:   +(row.m   ?? row.Matches)    || 0,
    w:   +(row.w   ?? row.Won)        || 0,
    l:   +(row.l   ?? row.Lost)       || 0,
    nr:  +(row.nr  ?? row.NoResult)   || 0,
    pts: +(row.pts ?? row.Points)     || 0,
    nrr: +(row.nrr ?? row.NetRunRate) || 0,
  })).filter(t => VALID.has(t.name));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        tools: [
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
          {
            name: 'save_standings',
            description: 'Save the current IPL 2026 points table after searching for it',
            input_schema: {
              type: 'object',
              required: ['standings'],
              properties: {
                standings: {
                  type: 'array',
                  description: 'All 10 IPL 2026 teams',
                  items: {
                    type: 'object',
                    required: ['name','m','w','l','nr','pts','nrr'],
                    properties: {
                      name: { type: 'string', description: 'Use: RCB SRH GT PBKS CSK RR DC KKR MI LSG' },
                      m:   { type: 'integer', description: 'Matches played' },
                      w:   { type: 'integer', description: 'Wins' },
                      l:   { type: 'integer', description: 'Losses' },
                      nr:  { type: 'integer', description: 'No results / ties' },
                      pts: { type: 'integer', description: 'Points (w*2 + nr*1)' },
                      nrr: { type: 'number',  description: 'Net Run Rate, signed decimal' },
                    },
                  },
                },
              },
            },
          },
        ],
        messages: [{
          role: 'user',
          content:
            'Search for the current IPL 2026 points table on cricbuzz.com. ' +
            'After finding the data, call save_standings with all 10 teams. ' +
            'Team abbreviations to use: RCB SRH GT PBKS CSK RR DC KKR MI LSG.',
        }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(502).json({
        error: data?.error?.message || `Anthropic API error ${upstream.status}`,
      });
    }

    // Extract the save_standings tool call — this gives us clean structured data
    const toolUse = (data.content || []).find(
      b => b.type === 'tool_use' && b.name === 'save_standings'
    );

    if (!toolUse) {
      const txt = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .slice(0, 300);
      return res.status(200).json({
        error: `save_standings not called. Claude said: "${txt}"`,
      });
    }

    const standings = normalise(toolUse.input.standings);

    if (standings.length !== 10) {
      return res.status(200).json({
        error: `Expected 10 teams, got ${standings.length}: ${standings.map(t=>t.name).join(', ')}`,
      });
    }

    return res.status(200).json({ standings });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
