/* ==========================================================================
   canvasOverlays.js
   Draws the three toggleable overlays on top of the uploaded creative:
   attention heatmap, safe-zone guides, and a text-density highlight.
   All overlays are derived from the same metrics ImageAnalysis already
   computed — no separate analysis pass needed.
   ========================================================================== */

const CanvasOverlays = (() => {

  function sizeCanvasToImage(canvas, img) {
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function clear(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ------------------------------------------------------------------
  // Attention heatmap — renders the 3x3 edge-energy grid as soft,
  // color-mapped blobs (low energy = cool/transparent, high = warm/red).
  // This approximates where a viewer's eye is drawn, based on local
  // contrast and detail density — a well-established proxy for visual
  // salience, not an eye-tracking result.
  // ------------------------------------------------------------------
  function drawHeatmap(canvas, img, metrics) {
    sizeCanvasToImage(canvas, img);
    const ctx = canvas.getContext('2d');
    const { width: cw, height: ch } = canvas;
    if (!metrics || !metrics.grid) return;

    const rows = metrics.grid.length;
    const cols = metrics.grid[0].length;
    const allEdges = metrics.grid.flat().map(c => c.meanEdge);
    const maxEdge = Math.max(...allEdges, 1);

    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'blur(28px)';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const intensity = clamp(metrics.grid[r][c].meanEdge / maxEdge, 0, 1);
        if (intensity < 0.15) continue;
        const cx = (c + 0.5) * (cw / cols);
        const cy = (r + 0.5) * (ch / rows);
        const radius = Math.max(cw, ch) * 0.28;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(255, 77, 109, ${0.45 * intensity})`);
        grad.addColorStop(0.5, `rgba(255, 176, 32, ${0.28 * intensity})`);
        grad.addColorStop(1, 'rgba(255, 176, 32, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);
      }
    }
    ctx.filter = 'none';
  }

  // ------------------------------------------------------------------
  // Safe-zone guides — draws the margin Meta reserves for UI chrome
  // (profile pic, caption, CTA sticker, progress bar) per placement.
  // ------------------------------------------------------------------
  function drawSafeZones(canvas, img, platform) {
    sizeCanvasToImage(canvas, img);
    const ctx = canvas.getContext('2d');
    const { width: cw, height: ch } = canvas;
    const zone = AppConfig.SAFE_ZONES[platform];
    if (!zone) return;

    const top = zone.top * ch, bottom = zone.bottom * ch;
    const left = zone.left * cw, right = zone.right * cw;

    // Dim the unsafe margins
    ctx.fillStyle = 'rgba(8, 9, 12, 0.55)';
    ctx.fillRect(0, 0, cw, top);
    ctx.fillRect(0, ch - bottom, cw, bottom);
    ctx.fillRect(0, top, left, ch - top - bottom);
    ctx.fillRect(cw - right, top, right, ch - top - bottom);

    // Safe area outline
    ctx.strokeStyle = 'rgba(60, 232, 176, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(left, top, cw - left - right, ch - top - bottom);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(60, 232, 176, 0.95)';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('SAFE ZONE', left + 8, top + 16);
  }

  // ------------------------------------------------------------------
  // Text-density highlight — shades the regions where the sharp-edge
  // ("text-like") pixel density is high, so it's visually obvious where
  // on-image text is concentrated.
  // ------------------------------------------------------------------
  function drawTextDensity(canvas, img, metrics) {
    sizeCanvasToImage(canvas, img);
    const ctx = canvas.getContext('2d');
    const { width: cw, height: ch } = canvas;
    if (!metrics || !metrics.grid) return;

    const rows = metrics.grid.length;
    const cols = metrics.grid[0].length;
    const allEdges = metrics.grid.flat().map(c => c.meanEdge);
    const maxEdge = Math.max(...allEdges, 1);
    const cellW = cw / cols, cellH = ch / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const intensity = clamp(metrics.grid[r][c].meanEdge / maxEdge, 0, 1);
        if (intensity < 0.35) continue;
        ctx.fillStyle = `rgba(255, 176, 32, ${0.22 * intensity})`;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        ctx.strokeStyle = `rgba(255, 176, 32, ${0.5 * intensity})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(c * cellW + 1, r * cellH + 1, cellW - 2, cellH - 2);
      }
    }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return {
    sizeCanvasToImage,
    clear,
    drawHeatmap,
    drawSafeZones,
    drawTextDensity,
  };
})();
