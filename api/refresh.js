module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const prompt =
    `Search for "IPL 2026 points table cricbuzz" and get the current standings. ` +
    `Return ONLY this JSON, no other text:\n` +
    `{"standings":[{"name":"RCB","m":12,"w":7,"l":5,"nr":0,"pts":14,"nrr":0.50}]}\n` +
    `All 10 teams: RCB SRH GT PBKS CSK RR DC KKR MI LSG. nrr is signed decimal.`;

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
        max_tokens: 512,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const msg = data?.error?.message || JSON.stringify(data?.error) || `Anthropic API error ${upstream.status}`;
      return res.status(502).json({ error: msg });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: `Upstream fetch failed: ${err.message}` });
  }
};
