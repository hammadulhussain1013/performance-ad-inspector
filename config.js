/* ==========================================================================
   config.js
   Single source of truth for scoring weights, thresholds, and platform
   specs. Change numbers here and every module (heuristic scorer, Gemini
   normalizer, renderer) picks them up automatically.
   ========================================================================== */

const AppConfig = (() => {

  // Category weights. Must sum to 100 — CATEGORY_WEIGHTS.reduce check
  // below will throw in the console during development if you break it.
  const CATEGORIES = [
    { key: 'visual_hierarchy', title: 'Visual Hierarchy',  max: 15 },
    { key: 'hook_visibility',  title: 'Hook Visibility',   max: 15 },
    { key: 'cta_visibility',   title: 'CTA Visibility',    max: 10 },
    { key: 'brand_presence',   title: 'Brand Presence',    max: 5  },
    { key: 'product_focus',    title: 'Product Focus',     max: 10 },
    { key: 'whitespace',       title: 'Whitespace',        max: 10 },
    { key: 'contrast',         title: 'Contrast',          max: 5  },
    { key: 'readability',      title: 'Readability',       max: 10 },
    { key: 'emotional_appeal', title: 'Emotional Appeal',  max: 5  },
    { key: 'offer_clarity',    title: 'Offer Clarity',     max: 5  },
    { key: 'trust_signals',    title: 'Trust Signals',     max: 5  },
    { key: 'platform_readiness', title: 'Platform Readiness', max: 5 },
  ];

  const totalPoints = CATEGORIES.reduce((sum, c) => sum + c.max, 0);
  if (totalPoints !== 100) {
    // Loud in dev, harmless in prod — scores would just not be out of 100.
    console.warn(`AppConfig: category weights sum to ${totalPoints}, expected 100.`);
  }

  // Overall rating bands
  const RATING_BANDS = [
    { min: 90, label: 'Excellent',          color: '#00D99A' },
    { min: 75, label: 'Good',               color: '#3CE8B0' },
    { min: 55, label: 'Average',            color: '#FFB020' },
    { min: 35, label: 'Needs Improvement',  color: '#FF8A5B' },
    { min: 0,  label: 'Poor',               color: '#FF4D6D' },
  ];

  function ratingFor(score) {
    return RATING_BANDS.find(b => score >= b.min) || RATING_BANDS[RATING_BANDS.length - 1];
  }

  // Standard Meta placement aspect ratios (width / height)
  const PLATFORM_RATIOS = {
    feed_square:  { ratio: 1,       label: '1:1 Feed' },
    feed_portrait:{ ratio: 4 / 5,   label: '4:5 Feed' },
    story_reels:  { ratio: 9 / 16,  label: '9:16 Story/Reels' },
    landscape:    { ratio: 1.91,    label: '1.91:1 Landscape' },
  };

  // Safe-zone guide boxes as fractions of frame, per placement.
  // top/bottom = margin to keep clear of UI chrome (profile pic, captions,
  // CTA sticker, progress bar) per Meta's published placement guidance.
  const SAFE_ZONES = {
    feed:  { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
    story: { top: 0.14, bottom: 0.20, left: 0.06, right: 0.06 },
    reels: { top: 0.14, bottom: 0.34, left: 0.06, right: 0.12 },
  };

  const GEMINI_MODEL_DEFAULT = 'gemini-2.0-flash';

  // -------------------- API key persistence (localStorage) --------------------
  const STORAGE_KEY = 'pai_gemini_api_key';
  const STORAGE_MODEL = 'pai_gemini_model';

  function getApiKey() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setApiKey(key) {
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* localStorage unavailable — key just won't persist */ }
  }
  function getModel() {
    try { return localStorage.getItem(STORAGE_MODEL) || GEMINI_MODEL_DEFAULT; }
    catch (e) { return GEMINI_MODEL_DEFAULT; }
  }
  function setModel(model) {
    try { localStorage.setItem(STORAGE_MODEL, model); }
    catch (e) { /* ignore */ }
  }

  return {
    CATEGORIES,
    RATING_BANDS,
    ratingFor,
    PLATFORM_RATIOS,
    SAFE_ZONES,
    GEMINI_MODEL_DEFAULT,
    getApiKey,
    setApiKey,
    getModel,
    setModel,
  };
})();
