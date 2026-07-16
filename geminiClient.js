/* ==========================================================================
   geminiClient.js
   Talks to the Gemini API (generativelanguage.googleapis.com) directly from
   the browser using the key the user pastes into the config drawer. If you
   want to change what the model is asked to look for, edit GEMINI_PROMPT
   below — nothing else needs to change.
   ========================================================================== */

const GeminiClient = (() => {

  // ------------------------------------------------------------------
  // EDIT ME: this is the entire instruction sent to Gemini alongside
  // the image. Keep the "respond with ONLY JSON" instruction and the
  // category key list in sync with AppConfig.CATEGORIES if you add or
  // rename categories.
  // ------------------------------------------------------------------
  const GEMINI_PROMPT = `
You are a senior performance creative strategist who has audited thousands of Meta (Facebook & Instagram) ad creatives for direct-response advertisers. You are reviewing a single static ad creative image.

Evaluate the image against real direct-response design principles. Specifically inspect:
layout, color, typography, hierarchy, offer, CTA, emotional triggers, visual clarity, scroll/thumb-stop power, brand recognition, product focus, conversion potential, mobile-friendliness, Facebook Feed compatibility, Instagram Feed compatibility, Instagram Story compatibility, audience psychology, direct-response principles (FOMO, urgency, curiosity, trust), visual distractions, image quality, cropping, safe margins, text density/readability, and thumb-stop potential.

Score the creative across exactly these 12 categories, using exactly these point maximums (total = 100):
- visual_hierarchy (max 15)
- hook_visibility (max 15)
- cta_visibility (max 10)
- brand_presence (max 5)
- product_focus (max 10)
- whitespace (max 10)
- contrast (max 5)
- readability (max 10)
- emotional_appeal (max 5)
- offer_clarity (max 5)
- trust_signals (max 5)
- platform_readiness (max 5)

Scoring rules to apply consistently:
- Large, readable headline -> higher score. Tiny or unreadable text -> lower score.
- Strong contrast between elements and background -> higher score.
- Product hidden, cropped awkwardly, or hard to identify -> lower score.
- No visible CTA -> low cta_visibility. Weak/blended CTA -> mid score.
- Weak or absent visual hierarchy (nothing draws the eye first) -> lower score.
- No clear offer or value proposition -> low offer_clarity.
- Excessive on-image text or clutter -> lower readability and whitespace.
- Poor spacing / cramped layout -> lower whitespace score.
- Professional, well-paired typography -> higher score.
- Genuine emotional pull (aspirational, relatable, urgent) -> higher emotional_appeal.
- Visible, well-integrated branding -> higher brand_presence, but oversized logos that hurt hierarchy should cost visual_hierarchy points instead.

Respond with ONLY raw JSON, no markdown code fences, no commentary before or after. Match this exact shape:

{
  "overall_score": 0,
  "categories": [
    { "key": "visual_hierarchy", "title": "Visual Hierarchy", "max": 15, "score": 0, "reason": "", "recommendation": "" },
    { "key": "hook_visibility", "title": "Hook Visibility", "max": 15, "score": 0, "reason": "", "recommendation": "" },
    { "key": "cta_visibility", "title": "CTA Visibility", "max": 10, "score": 0, "reason": "", "recommendation": "" },
    { "key": "brand_presence", "title": "Brand Presence", "max": 5, "score": 0, "reason": "", "recommendation": "" },
    { "key": "product_focus", "title": "Product Focus", "max": 10, "score": 0, "reason": "", "recommendation": "" },
    { "key": "whitespace", "title": "Whitespace", "max": 10, "score": 0, "reason": "", "recommendation": "" },
    { "key": "contrast", "title": "Contrast", "max": 5, "score": 0, "reason": "", "recommendation": "" },
    { "key": "readability", "title": "Readability", "max": 10, "score": 0, "reason": "", "recommendation": "" },
    { "key": "emotional_appeal", "title": "Emotional Appeal", "max": 5, "score": 0, "reason": "", "recommendation": "" },
    { "key": "offer_clarity", "title": "Offer Clarity", "max": 5, "score": 0, "reason": "", "recommendation": "" },
    { "key": "trust_signals", "title": "Trust Signals", "max": 5, "score": 0, "reason": "", "recommendation": "" },
    { "key": "platform_readiness", "title": "Platform Readiness", "max": 5, "score": 0, "reason": "", "recommendation": "" }
  ],
  "summary": "",
  "strengths": ["", "", ""],
  "weaknesses": ["", "", ""],
  "quick_fixes": ["", "", "", ""],
  "improvements": ["", "", "", "", ""],
  "predicted_ctr": "Low | Medium | High | Very High",
  "predicted_conversion": "Low | Medium | High | Very High",
  "thumb_stop_rating": 0,
  "meta_text_warning": false,
  "detected_aspect_note": ""
}

overall_score must equal the sum of all category scores. thumb_stop_rating is 0-10. meta_text_warning should be true if on-image text appears to cover roughly 20% or more of the frame. Keep every "reason" and "recommendation" to one or two concrete sentences — no filler, no generic advice that could apply to any ad.
`.trim();

  // ------------------------------------------------------------------
  // Convert a File/Blob to base64 (no data: prefix) for the Gemini API
  // ------------------------------------------------------------------
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------------
  // Call Gemini's generateContent endpoint with the image + prompt
  // ------------------------------------------------------------------
  async function callGemini(file, apiKey, model) {
    const base64Data = await fileToBase64(file);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          parts: [
            { text: GEMINI_PROMPT },
            { inline_data: { mime_type: file.type, data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200) || res.statusText}`);
    }

    const data = await res.json();
    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    if (!rawText) throw new Error('Gemini returned an empty response.');

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error('Gemini response was not valid JSON — try again or switch models.');
    }

    return normalize(parsed, file);
  }

  // ------------------------------------------------------------------
  // Normalize Gemini's JSON into the exact same shape ImageAnalysis
  // produces, so render.js is engine-agnostic.
  // ------------------------------------------------------------------
  function normalize(parsed, file) {
    const defs = AppConfig.CATEGORIES;
    const byKey = new Map((parsed.categories || []).map(c => [c.key, c]));

    const categories = defs.map(def => {
      const c = byKey.get(def.key) || {};
      const score = clamp(Number(c.score) || 0, 0, def.max);
      return {
        key: def.key,
        title: def.title,
        score,
        max: def.max,
        reason: c.reason || 'No reasoning returned for this category.',
        recommendation: c.recommendation || 'No recommendation returned for this category.',
      };
    });

    const computedOverall = round(categories.reduce((sum, c) => sum + c.score, 0));
    const overall = clamp(Number(parsed.overall_score) || computedOverall, 0, 100);
    const rating = AppConfig.ratingFor(overall).label;

    return {
      mode: 'gemini',
      overall_score: overall,
      rating,
      categories,
      summary: parsed.summary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(Boolean) : [],
      quick_fixes: Array.isArray(parsed.quick_fixes) ? parsed.quick_fixes.filter(Boolean) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.filter(Boolean) : [],
      predicted_ctr: normalizeTier(parsed.predicted_ctr),
      predicted_conversion: normalizeTier(parsed.predicted_conversion),
      thumb_stop_rating: clamp(Number(parsed.thumb_stop_rating) || 0, 0, 10),
      meta_text_warning: !!parsed.meta_text_warning,
      detected_aspect_note: parsed.detected_aspect_note || '',
      metrics: null, // filled in by main.js from a parallel heuristic pixel pass, used only for overlays
    };
  }

  function normalizeTier(v) {
    const allowed = ['Low', 'Medium', 'High', 'Very High'];
    return allowed.includes(v) ? v : 'Medium';
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v) { return Math.round(v * 10) / 10; }

  return {
    callGemini,
    GEMINI_PROMPT, // exposed in case a caller wants to display/edit it in-app later
  };
})();
