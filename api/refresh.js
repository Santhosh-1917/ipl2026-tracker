module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const { lastId = 55 } = req.body || {};

  const prompt =
    `Search for IPL 2026 T20 cricket match results. Find completed matches after Match ${lastId}. ` +
    `Schedule: M56 GT vs SRH May12, M57 RCB vs KKR May13, M58 PBKS vs MI May14, ` +
    `M59 LSG vs CSK May15, M60 KKR vs GT May16, M61 PBKS vs RCB May17, ` +
    `M62 DC vs RR May17, M63 CSK vs SRH May18, M64 RR vs LSG May19, ` +
    `M65 KKR vs MI May20, M66 GT vs CSK May21, M67 SRH vs RCB May22, ` +
    `M68 LSG vs PBKS May23, M69 MI vs RR May24, M70 KKR vs DC May24. ` +
    `Return ONLY a JSON array no other text: [{"id":56,"winner":"GT","margin":"5 wkts"}]. ` +
    `If no new results after M${lastId} return exactly: []`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Upstream fetch failed' });
  }
};
