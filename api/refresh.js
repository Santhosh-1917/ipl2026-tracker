module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });

  const prompt =
    `You must use the web_search tool to look up live data. Do NOT use your training data.\n\n` +
    `Step 1: Search for "IPL 2026 points table site:iplt20.com" and also visit https://www.iplt20.com/matches/points-table to get the current IPL 2026 standings.\n` +
    `Step 2: Search for "IPL 2026 match results today" or visit https://www.iplt20.com/matches/results to get recent completed match results.\n\n` +
    `Return ONLY a single JSON object, no other text, no markdown:\n` +
    `{"standings":[{"name":"RCB","m":12,"w":7,"l":5,"nr":0,"pts":14,"nrr":0.500}],"results":[{"id":56,"winner":"GT","margin":"5 wkts"}]}\n\n` +
    `Rules:\n` +
    `- standings must have exactly 10 entries for: RCB, SRH, GT, PBKS, CSK, RR, DC, KKR, MI, LSG\n` +
    `- nrr is a number (positive or negative decimal), pts is wins×2 + NR×1\n` +
    `- results only contains matches that are fully completed (not in-progress)\n` +
    `- Match IDs: M56=GT vs SRH(May12), M57=RCB vs KKR(May13), M58=PBKS vs MI(May14), M59=LSG vs CSK(May15), M60=KKR vs GT(May16), M61=PBKS vs RCB(May17), M62=DC vs RR(May17), M63=CSK vs SRH(May18), M64=RR vs LSG(May19), M65=KKR vs MI(May20), M66=GT vs CSK(May21), M67=SRH vs RCB(May22), M68=LSG vs PBKS(May23), M69=MI vs RR(May24), M70=KKR vs DC(May24)\n` +
    `- Use the exact team abbreviations listed above`;

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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
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
