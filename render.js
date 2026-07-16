/* ==========================================================================
   render.js
   Pure(ish) DOM rendering. Takes the unified AnalysisResult shape (produced
   by either ImageAnalysis or GeminiClient — they're identical) and paints
   every panel. Doesn't know or care which engine produced the data.
   ========================================================================== */

const Render = (() => {

  const RING_CIRCUMFERENCE = 2 * Math.PI * 70; // matches the SVG circle r=70

  function scoreColor(pct) {
    if (pct >= 0.9) return '#00D99A';
    if (pct >= 0.75) return '#3CE8B0';
    if (pct >= 0.55) return '#FFB020';
    if (pct >= 0.35) return '#FF8A5B';
    return '#FF4D6D';
  }

  function el(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------
  // Overall score ring + rating badge + summary + prediction chips
  // ------------------------------------------------------------------
  function renderOverall(result) {
    const pct = result.overall_score / 100;
    const color = scoreColor(pct);
    const offset = RING_CIRCUMFERENCE * (1 - pct);

    const ring = el('score-ring');
    ring.style.stroke = color;
    // Force reflow so the transition plays from the previous state
    requestAnimationFrame(() => { ring.style.strokeDashoffset = offset; });

    animateNumber(el('overall-score-num'), result.overall_score);

    const badge = el('rating-badge');
    badge.textContent = result.rating;
    badge.style.color = color;
    badge.style.borderColor = color + '66';
    badge.style.background = color + '14';

    el('analysis-summary').textContent = result.summary;
    el('pred-ctr').textContent = result.predicted_ctr;
    el('pred-conv').textContent = result.predicted_conversion;
    el('pred-thumbstop').textContent = result.thumb_stop_rating;

    const warning = el('text-warning-banner');
    warning.classList.toggle('hidden', !result.meta_text_warning);
  }

  function animateNumber(node, target) {
    const start = 0;
    const duration = 900;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------
  // Category breakdown cards
  // ------------------------------------------------------------------
  function renderCategories(result) {
    const list = el('category-list');
    list.innerHTML = '';
    result.categories.forEach((cat, i) => {
      const pct = cat.max ? cat.score / cat.max : 0;
      const color = scoreColor(pct);
      const card = document.createElement('div');
      card.className = 'category-card bg-ink-900/60 border border-ink-700 rounded-xl p-5 fade-up';
      card.style.animationDelay = `${i * 35}ms`;
      card.innerHTML = `
        <div class="flex items-center justify-between mb-2.5">
          <h3 class="font-medium text-sm">${escapeHtml(cat.title)}</h3>
          <span class="font-mono text-sm font-semibold" style="color:${color}">${cat.score}<span class="text-mist-500 font-normal"> / ${cat.max}</span></span>
        </div>
        <div class="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-3">
          <div class="h-full rounded-full transition-all duration-700" style="width:${Math.round(pct * 100)}%; background:${color};"></div>
        </div>
        <p class="text-[13px] text-mist-400 leading-relaxed">${escapeHtml(cat.reason)}</p>
        <p class="text-[13px] text-mist-300 leading-relaxed mt-2 pl-3 border-l-2" style="border-color:${color}66">
          <span class="text-mist-500 font-mono text-[10px] uppercase tracking-wider block mb-0.5">Fix</span>
          ${escapeHtml(cat.recommendation)}
        </p>
      `;
      list.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // Strengths / weaknesses / quick fixes / improvements lists
  // ------------------------------------------------------------------
  function renderLists(result) {
    fillList('strengths-list', result.strengths, '#00D99A');
    fillList('weaknesses-list', result.weaknesses, '#FF4D6D');
    fillList('quickfixes-list', result.quick_fixes, '#FFB020');

    const improvements = el('improvements-list');
    improvements.innerHTML = '';
    (result.improvements || []).forEach(text => {
      const li = document.createElement('li');
      li.className = 'flex items-start gap-2.5 text-sm text-mist-300 leading-relaxed';
      li.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></span><span>${escapeHtml(text)}</span>`;
      improvements.appendChild(li);
    });
    if (!result.improvements || !result.improvements.length) {
      improvements.innerHTML = '<li class="text-sm text-mist-500">No high-impact fixes surfaced — this creative is close to optimized.</li>';
    }
  }

  function fillList(id, items, color) {
    const node = el(id);
    node.innerHTML = '';
    (items || []).forEach(text => {
      const li = document.createElement('li');
      li.className = 'flex items-start gap-2.5';
      li.innerHTML = `<span class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style="background:${color}"></span><span>${escapeHtml(text)}</span>`;
      node.appendChild(li);
    });
    if (!items || !items.length) {
      node.innerHTML = '<li class="text-mist-500">Not enough signal returned for this section.</li>';
    }
  }

  // ------------------------------------------------------------------
  // Contrast / text density meters
  // ------------------------------------------------------------------
  function renderMeters(result) {
    const contrastCat = result.categories.find(c => c.key === 'contrast');
    const contrastPct = contrastCat ? contrastCat.score / contrastCat.max : 0;
    el('contrast-bar').style.width = `${Math.round(contrastPct * 100)}%`;
    el('contrast-bar').style.background = scoreColor(contrastPct);
    el('contrast-verdict').textContent = contrastPct > 0.7 ? 'Strong' : contrastPct > 0.4 ? 'Moderate' : 'Weak';
    el('contrast-value').textContent = result.metrics ? `stddev ${result.metrics.contrastStddev.toFixed(1)}` : `${Math.round(contrastPct * 100)}%`;

    const density = result.metrics ? result.metrics.textDensity : (result.meta_text_warning ? 0.22 : 0.1);
    const densityPct = Math.min(1, density / 0.3);
    el('density-bar').style.width = `${Math.round(densityPct * 100)}%`;
    el('density-bar').style.background = density > 0.13 ? '#FF4D6D' : '#FFB020';
    el('density-verdict').textContent = density > 0.18 ? 'Heavy' : density > 0.1 ? 'Moderate' : 'Light';
    el('density-value').textContent = `~${Math.round(density * 100)}% of frame`;
  }

  // ------------------------------------------------------------------
  // Aspect ratio + platform compatibility
  // ------------------------------------------------------------------
  function renderPlatformCompat(result) {
    const info = result.aspect_ratio;
    if (!info) return;
    el('ratio-detail').textContent = `${info.ratioValue.toFixed(2)}:1 → nearest ${info.nearest}`;

    const rows = [
      ['Feed', info.compatibility.feed],
      ['Story', info.compatibility.story],
      ['Reels', info.compatibility.reels],
      ['Carousel', info.compatibility.carousel],
    ];
    const list = el('platform-compat-list');
    list.innerHTML = rows.map(([name, ok]) => `
      <div class="flex items-center justify-between text-sm">
        <span class="text-mist-300">${name}</span>
        <span class="flex items-center gap-1.5 text-xs font-mono ${ok ? 'text-mint-500' : 'text-mist-500'}">
          ${ok ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Ready' : 'Needs crop'}
        </span>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------------
  // Engine badge in header
  // ------------------------------------------------------------------
  function renderEngineBadge(mode) {
    const badge = el('engine-badge');
    const dot = badge.querySelector('span');
    if (mode === 'gemini') {
      badge.lastChild.textContent = ' Gemini Vision';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-violet-400';
    } else {
      badge.lastChild.textContent = ' Heuristic Engine';
      dot.className = 'w-1.5 h-1.5 rounded-full bg-mist-500';
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function renderAll(result) {
    renderOverall(result);
    renderCategories(result);
    renderLists(result);
    renderMeters(result);
    renderPlatformCompat(result);
    renderEngineBadge(result.mode);
  }

  return { renderAll, renderEngineBadge };
})();
