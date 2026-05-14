module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const prompt =
    `Get the current IPL 2026 points table. ` +
    `Try https://www.cricbuzz.com/cricket-series/9241/indian-premier-league-2026/points-table first. ` +
    `If that has no data, try https://www.iplt20.com/matches/points-table instead. ` +
    `Return ONLY raw JSON, no markdown, no explanation:\n` +
    `{"standings":[{"name":"RCB","m":12,"w":7,"l":5,"nr":0,"pts":14,"nrr":0.50}]}\n` +
    `All 10 teams: RCB SRH GT PBKS CSK RR DC KKR MI LSG. nrr is a signed decimal number.`;

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
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = data?.error?.message || JSON.stringify(data?.error) || `Anthropic API error ${upstream.status}`;
      return res.status(502).json({ error: msg });
    }

    // Extract text content from Claude's response
    const txt = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Try to extract JSON — handle plain JSON or markdown code fences
    const stripped = txt.replace(/```(?:json)?\n?/g, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);

    if (!match) {
      // Return Claude's raw reply so the frontend can show it
      return res.status(200).json({ error: `No JSON found. Claude said: "${txt.slice(0, 300)}"` });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return res.status(200).json({ error: `Malformed JSON: ${match[0].slice(0, 200)}` });
    }

    if (!Array.isArray(parsed.standings) || parsed.standings.length !== 10) {
      return res.status(200).json({ error: `Expected 10 teams, got ${parsed.standings?.length ?? 0}. Raw: "${txt.slice(0, 300)}"` });
    }

    return res.status(200).json({ standings: parsed.standings });

  } catch (err) {
    return res.status(500).json({ error: `Upstream fetch failed: ${err.message}` });
  }
};
