# IPL 2026 Playoff Tracker

A single-file React web app tracking IPL 2026 playoff qualification in real time.
Uses Claude AI (web search) to auto-fetch match results and a Monte Carlo simulation
to calculate qualification probabilities for all 10 teams.

---

## How to Host (zero-config options)

| Platform | Steps |
|----------|-------|
| **Netlify Drop** | Go to [netlify.com/drop](https://app.netlify.com/drop), drag the `index.html` file — live in 30 seconds |
| **GitHub Pages** | Push to a repo → Settings → Pages → Deploy from branch (`main`, root) |
| **Vercel** | `npx vercel` inside the folder, follow the prompts |
| **Cloudflare Pages** | Dashboard → Pages → Upload assets → drag `index.html` |
| **Any static host** | Upload the single `index.html` file — no server, no build step needed |

The file is 100% self-contained. No dependencies to install.

---

## How to Use

1. Open `index.html` in a browser (or the hosted URL)
2. Enter your Anthropic API key — get a free key at [console.anthropic.com](https://console.anthropic.com)
3. The app loads standings from the Match 55 baseline
4. Click **Refresh now** to fetch the latest results via Claude AI web search
5. Auto-refreshes every 15 minutes in the background

Your API key is stored in `localStorage` (browser only). It is never sent anywhere except Anthropic's API.

---

## Architecture

### Tech stack
- React 18 via CDN (no build step — Babel transpiles JSX in the browser)
- Google Fonts (Inter)
- Anthropic API: `claude-sonnet-4-20250514` + `web_search_20250305` tool
- Pure CSS — no UI framework

### Data flow
```
User clicks Refresh
  → Claude API (web_search) fetches live IPL results
  → Results parsed from JSON response
  → applyRes() updates team standings
  → runMC() runs 5 000 Monte Carlo simulations
  → Qualification % updated for all teams
  → State persisted to localStorage
```

### Key data constants (update as the season progresses)

| Constant | Purpose |
|----------|---------|
| `INIT_STD` | Baseline standings after Match 55 |
| `SCHED` | Remaining fixtures M56–M70 |
| `TC` | Team color palette (hex values) |
| `NOTES` | Per-team trend arrow + short blurb |
| `HIST` | Full match-by-match W/L/NR history per team |
| `ANA` | Rich per-team analysis: form story, scenarios, threats, probability |

### Win probability model (`wp` function)
Calculates head-to-head win probability using a logistic function over:
- Points difference (weight: 0.07)
- NRR difference (weight: 0.18)
- Recent form difference — last 5 results (weight: 0.09)
- Output clamped to [0.17, 0.83] — no team is ever a certainty

### Monte Carlo simulation (`runMC`)
Runs `n=5000` simulated seasons by:
1. Simulating each remaining match with the `wp` probability
2. Sorting final standings by pts → NRR
3. Counting how often each team finishes in the top 4
4. Returning qualification % per team

---

## Updating for Future Seasons / Phases

1. **Update `INIT_STD`** with current standings (pts, NRR, form, matches played)
2. **Update `SCHED`** with remaining fixtures and their match IDs
3. **Update `ANA`** with fresh written analysis per team
4. **Update `HIST`** with match-by-match results per team
5. **Update the model string** if a newer Claude version is available:
   ```js
   model:'claude-sonnet-4-20250514'  // change this
   ```
6. **Update the search prompt** in `refresh()` to match the new fixture schedule

---

## Security Notes

- The API key is stored in `localStorage` and used directly in browser fetch calls
- The `anthropic-dangerous-direct-browser-access: true` header is required for this to work
- This is intentional for a personal/public tracker — acceptable for this use case
- **Do not hardcode your API key** into the file if hosting publicly — the setup screen is there so each visitor uses their own key

---

## Design System

### Color tokens
```
--bg:     #070B14   (page background)
--card:   #0F1624   (card surfaces)
--orange: #FF6B35   (primary accent)
--gold:   #FFB800   (secondary accent)
--green:  #10D876   (wins / positive)
--red:    #FF3B5E   (losses / negative)
```

### Team colors (stored in `TC` object)
Each team has: `p` (primary), `bg` (background tint), `t` (text/icon color)

### Probability color coding
| Range | Color | Label |
|-------|-------|-------|
| ≥ 70% | Green `#10D876` | Very likely |
| 45–69% | Blue `#3B82F6` | In the fight |
| 15–44% | Amber `#FFB800` | Long shot |
| < 15% | Red `#FF3B5E` | Near out |

---

## File Structure

```
ipl2026-tracker/
├── index.html   ← entire app (HTML + CSS + React)
└── CLAUDE.md    ← this file
```
