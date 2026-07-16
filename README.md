# Performance Ad Inspector AI

A single-page tool that audits a static Meta (Facebook/Instagram) ad creative
against real direct-response design principles and returns a 100-point
scorecard, broken down by category, with concrete fixes.

No build step. No backend. Open `index.html` and it runs.

## Running it

Because the app loads its JS as separate `<script src="js/...">` files,
opening `index.html` directly from disk (`file://`) will work in most
browsers, but some browsers restrict `fetch`/canvas operations on `file://`.
For a completely smooth local run, serve the folder instead:

```bash
cd performance-ad-inspector
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just double-click `index.html` — it will work in Chrome/Edge/Firefox for
local files in almost all cases; the one exception is if you see a CORS-type
console error, switch to the local server command above.

## Two analysis engines

**Heuristic engine (default, no setup required)**
Every score is computed from actual pixel data — luminance contrast,
edge/detail density, a 3×3 regional energy grid, color saturation, and
aspect ratio — not randomness. Categories that genuinely require reading
text or recognizing logos (Offer Clarity, Trust Signals, Brand Presence)
are scored conservatively and say so explicitly in their reasoning.

**Gemini Vision engine (optional)**
Click "Gemini Setup" in the header, paste an API key from
[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey),
and the app sends the image straight from your browser to Gemini with a
senior-creative-strategist prompt, asking for the same 12 categories back
as structured JSON. The key is stored only in your browser's
`localStorage` — there is no server component to this app at all.

If a Gemini call fails for any reason (bad key, rate limit, network), the
app automatically falls back to the heuristic engine and tells you why.

## Editing the Gemini prompt

Open `js/geminiClient.js` and edit the `GEMINI_PROMPT` constant near the
top of the file. Keep the category `key` list in sync with
`js/config.js` → `AppConfig.CATEGORIES` if you add, remove, or rename a
category — both files need to agree on the keys.

## Changing the scoring weights

`js/config.js` → `AppConfig.CATEGORIES` is the single source of truth for
category names and point maximums. It's asserted to sum to 100 on load
(a console warning fires in dev if it doesn't). Every other module reads
from this list — nothing else needs to change.

## File structure

```
performance-ad-inspector/
├── index.html              Page structure, Tailwind CDN config, all panels
├── css/
│   └── styles.css          Scan-sweep animation, focus states, small helpers
└── js/
    ├── config.js            Category weights, rating bands, platform specs, API key storage
    ├── imageAnalysis.js      Canvas pixel metrics + heuristic scoring engine
    ├── geminiClient.js       Gemini API call, prompt, response normalization
    ├── canvasOverlays.js     Heatmap / safe-zone / text-density overlay drawing
    ├── render.js             Takes an AnalysisResult and paints every panel
    └── main.js               Upload handling, drag & drop, wiring, overlay toggles
```

Both engines (`imageAnalysis.js` and `geminiClient.js`) produce the exact
same `AnalysisResult` shape, so `render.js` never needs to know or care
which one ran.

## Bonus tools included

- **Attention heatmap** — color-mapped overlay from the regional edge-energy grid
- **Safe-zone guide** — per-platform (Feed / Story / Reels) margin overlay
- **Text-density highlight** — shades regions with high estimated text/detail density
- **Meta 20% text warning** — flags when estimated text coverage is high
- **Contrast checker** and **text density meter** — numeric readouts with verdicts
- **Aspect ratio checker** — detects ratio and flags Feed/Story/Reels/Carousel compatibility

All overlays are estimates derived from pixel analysis, not OCR or an
official Meta text-overlay tool — the copy in the UI is intentionally
honest about that.
