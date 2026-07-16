/* ==========================================================================
   main.js
   Wires up the DOM: upload/drag-drop, the config drawer, the analyze flow
   (Gemini if a key is present, heuristic fallback otherwise), and the
   overlay/platform toggle buttons.
   ========================================================================== */

(() => {
  const $ = (id) => document.getElementById(id);

  let currentFile = null;
  let currentImg = null;        // <img> used for the small preview thumbnail
  let toolsImg = null;          // <img> used for the larger "tools" panel
  let lastResult = null;
  let activeOverlay = 'none';
  let activePlatform = 'feed';

  // ------------------------------------------------------------------
  // Config drawer
  // ------------------------------------------------------------------
  function openConfig() {
    $('config-overlay').classList.remove('hidden');
    requestAnimationFrame(() => $('config-overlay').classList.remove('opacity-0'));
    $('config-drawer').classList.remove('translate-x-full');
    refreshKeyStatus();
  }
  function closeConfig() {
    $('config-overlay').classList.add('opacity-0');
    $('config-drawer').classList.add('translate-x-full');
    setTimeout(() => $('config-overlay').classList.add('hidden'), 200);
  }
  function refreshKeyStatus() {
    const key = AppConfig.getApiKey();
    $('gemini-key-input').value = key;
    $('gemini-model-select').value = AppConfig.getModel();
    $('key-status').textContent = key
      ? 'Key saved — Gemini Vision will be used for analysis.'
      : 'No key saved — the heuristic engine will be used.';
    Render.renderEngineBadge(key ? 'gemini' : 'heuristic');
  }

  $('open-config-btn').addEventListener('click', openConfig);
  $('close-config-btn').addEventListener('click', closeConfig);
  $('config-overlay').addEventListener('click', closeConfig);

  $('save-key-btn').addEventListener('click', () => {
    AppConfig.setApiKey($('gemini-key-input').value.trim());
    AppConfig.setModel($('gemini-model-select').value);
    refreshKeyStatus();
  });
  $('clear-key-btn').addEventListener('click', () => {
    AppConfig.setApiKey('');
    refreshKeyStatus();
  });
  $('gemini-model-select').addEventListener('change', (e) => AppConfig.setModel(e.target.value));

  $('toggle-key-visibility').addEventListener('click', () => {
    const input = $('gemini-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // ------------------------------------------------------------------
  // Upload / drag & drop
  // ------------------------------------------------------------------
  const dropzone = $('dropzone');
  const fileInput = $('file-input');
  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_BYTES = 10 * 1024 * 1024;

  $('browse-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  dropzone.addEventListener('click', (e) => {
    if ($('dropzone-preview').classList.contains('hidden')) fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragging');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  function showError(msg) {
    const banner = $('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
    clearTimeout(showError._t);
    showError._t = setTimeout(() => banner.classList.add('hidden'), 4500);
  }

  function handleFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showError('Unsupported file type. Please upload a PNG, JPG, or WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showError('File is larger than 10MB. Please upload a smaller image.');
      return;
    }
    currentFile = file;
    const url = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      currentImg = img;
      $('preview-img').src = url;
      $('tools-preview-img').src = url;
      $('dropzone-empty').classList.add('hidden');
      $('dropzone-preview').classList.remove('hidden');
      $('file-name').textContent = file.name;
      $('file-meta').textContent = `${(file.size / 1024).toFixed(0)} KB · ${file.type.split('/')[1].toUpperCase()}`;

      const ratioInfo = ImageAnalysis.classifyAspectRatio(img.naturalWidth / img.naturalHeight);
      $('quick-ratio').textContent = `${(img.naturalWidth / img.naturalHeight).toFixed(2)}:1`;
      $('quick-resolution').textContent = `${img.naturalWidth}×${img.naturalHeight}`;

      // reset any previous results if re-uploading
      $('results-section').classList.add('hidden');
    };
    img.onerror = () => showError('Could not read that image — it may be corrupted.');
    img.src = url;
  }

  $('remove-file-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    resetUpload();
  });
  $('analyze-another-btn').addEventListener('click', () => {
    resetUpload();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function resetUpload() {
    currentFile = null;
    currentImg = null;
    lastResult = null;
    fileInput.value = '';
    $('dropzone-preview').classList.add('hidden');
    $('dropzone-empty').classList.remove('hidden');
    $('results-section').classList.add('hidden');
    $('loading-section').classList.add('hidden');
  }

  // ------------------------------------------------------------------
  // Analyze
  // ------------------------------------------------------------------
  const LOADING_MESSAGES_HEURISTIC = [
    'Reading pixels…',
    'Mapping contrast and edges…',
    'Scoring hierarchy and hook strength…',
    'Assembling your scorecard…',
  ];
  const LOADING_MESSAGES_GEMINI = [
    'Sending creative to Gemini Vision…',
    'Strategist is reviewing layout and offer…',
    'Scoring against direct-response principles…',
    'Assembling your scorecard…',
  ];

  function cycleLoadingMessages(messages) {
    let i = 0;
    $('loading-text').textContent = messages[0];
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      $('loading-text').textContent = messages[i];
    }, 1400);
    return () => clearInterval(interval);
  }

  $('analyze-btn').addEventListener('click', async () => {
    if (!currentFile || !currentImg) return;

    $('dropzone-preview').classList.add('hidden');
    $('loading-section').classList.remove('hidden');
    $('scan-sweep').classList.remove('hidden');
    $('scan-sweep').classList.add('active');

    const apiKey = AppConfig.getApiKey();
    const useGemini = !!apiKey;
    const stopCycling = cycleLoadingMessages(useGemini ? LOADING_MESSAGES_GEMINI : LOADING_MESSAGES_HEURISTIC);

    try {
      // Always compute the local pixel metrics — used for overlays
      // (heatmap/safe-zone/density) regardless of which engine scores it.
      const metrics = ImageAnalysis.extractMetrics(currentImg);

      let result;
      if (useGemini) {
        try {
          result = await GeminiClient.callGemini(currentFile, apiKey, AppConfig.getModel());
          result.metrics = metrics; // attach for overlay rendering
          const ratioInfo = ImageAnalysis.classifyAspectRatio(currentImg.naturalWidth / currentImg.naturalHeight);
          result.aspect_ratio = ratioInfo;
        } catch (geminiErr) {
          console.warn('Gemini analysis failed, falling back to heuristic engine:', geminiErr);
          showError(`Gemini analysis failed (${geminiErr.message}). Showing heuristic results instead.`);
          result = await ImageAnalysis.runHeuristicAnalysis(currentImg);
        }
      } else {
        result = await ImageAnalysis.runHeuristicAnalysis(currentImg);
      }

      lastResult = result;
      stopCycling();
      $('loading-section').classList.add('hidden');
      $('scan-sweep').classList.remove('active');
      $('scan-sweep').classList.add('hidden');
      $('results-section').classList.remove('hidden');
      $('results-section').classList.add('fade-up');

      Render.renderAll(result);
      resetOverlayToolbar();
      $('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      console.error(err);
      stopCycling();
      $('loading-section').classList.add('hidden');
      $('dropzone-preview').classList.remove('hidden');
      $('scan-sweep').classList.remove('active');
      $('scan-sweep').classList.add('hidden');
      showError(`Analysis failed: ${err.message}`);
    }
  });

  // ------------------------------------------------------------------
  // Overlay toolbar (heatmap / safe zones / text density)
  // ------------------------------------------------------------------
  function resetOverlayToolbar() {
    activeOverlay = 'none';
    document.querySelectorAll('.overlay-btn').forEach(b => b.classList.toggle('active-overlay', b.dataset.overlay === 'none'));
    $('safezone-platform-row').classList.add('hidden');
    CanvasOverlays.clear($('tools-canvas'));
  }

  document.querySelectorAll('.overlay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeOverlay = btn.dataset.overlay;
      document.querySelectorAll('.overlay-btn').forEach(b => b.classList.toggle('active-overlay', b === btn));
      $('safezone-platform-row').classList.toggle('hidden', activeOverlay !== 'safezone');
      drawActiveOverlay();
    });
  });

  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePlatform = btn.dataset.platform;
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.toggle('active-platform', b === btn));
      if (activeOverlay === 'safezone') drawActiveOverlay();
    });
  });

  function drawActiveOverlay() {
    const canvas = $('tools-canvas');
    const img = $('tools-preview-img');
    CanvasOverlays.clear(canvas);
    if (!lastResult || !lastResult.metrics) return;

    if (activeOverlay === 'heatmap') {
      CanvasOverlays.drawHeatmap(canvas, img, lastResult.metrics);
    } else if (activeOverlay === 'safezone') {
      CanvasOverlays.drawSafeZones(canvas, img, activePlatform);
    } else if (activeOverlay === 'density') {
      CanvasOverlays.drawTextDensity(canvas, img, lastResult.metrics);
    }
  }

  // Redraw overlay if window resizes (canvas is sized to rendered image)
  window.addEventListener('resize', () => {
    if (activeOverlay !== 'none') drawActiveOverlay();
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  refreshKeyStatus();
})();
