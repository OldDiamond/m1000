// ASCII silhouettes from the supplied footer reference, with scroll-only motion.
export async function setupFooterHands(options = {}) {
  const layers = [...document.querySelectorAll('.footer-hands')];
  if (!layers.length) return;
  if (options.enabled === false) { layers.forEach(layer => layer.hidden = true); return; }
  const columns = Math.max(40, Math.min(140, Number(options.columns) || 80));
  const pools = [' ', '.,:', '-~^:;', '+<>?!', '/\\()[]{}', '*#%@'];
  async function silhouette(src, columns) {
    const image = new Image(); image.src = src; await image.decode();
    const source = document.createElement('canvas');
    source.width = image.naturalWidth; source.height = image.naturalHeight;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
    let top = source.height, bottom = 0;
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (pixels[i + 3] > 20 && pixels[i] + pixels[i + 1] + pixels[i + 2] > 25) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    const height = Math.max(1, bottom - top + 1);
    const rows = Math.max(1, Math.round(columns * height / source.width));
    const small = document.createElement('canvas'); small.width = columns; small.height = rows;
    const ctx = small.getContext('2d');
    ctx.drawImage(image, 0, top, source.width, height, 0, 0, columns, rows);
    const data = ctx.getImageData(0, 0, columns, rows).data;
    const lines = [];
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < columns; x++) {
        const i = (y * columns + x) * 4;
        const luminance = (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255 * data[i + 3] / 255;
        const pool = pools[Math.min(pools.length - 1, Math.floor(luminance * pools.length * .85))];
        const choice = ((x * 31 + y * 17 + x * y * 7) % pool.length);
        line += pool[choice];
      }
      lines.push(line);
    }
    return { text: lines.join('\n'), rows };
  }
  let shapeSets;
  try {
    const densities = [...new Set([columns, Math.min(columns, 40)])];
    shapeSets = new Map(await Promise.all(densities.map(async density => [density,
      await Promise.all(['/assets/hands/left.png', '/assets/hands/right.png'].map(src => silhouette(src, density)))
    ])));
  }
  catch { layers.forEach(layer => layer.hidden = true); return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  layers.forEach(layer => {
    layer.style.setProperty('--hands-color', options.color || 'var(--accent)');
    layer.style.setProperty('--hands-opacity', Math.max(0, Math.min(1, Number(options.opacity ?? .25))));
    layer.dataset.ready = 'true';
  });
  const motion = layers.map(layer => ({ layer, progress: 0, target: 0 }));
  let frame = 0, previousTime = 0;
  function layout() {
    const density = innerWidth < 1280 ? Math.min(columns, 40) : columns;
    const shapes = shapeSets.get(density);
    layers.forEach(layer => {
      if (layer.dataset.columns !== String(density)) {
        layer.querySelectorAll('pre').forEach((pre, index) => pre.textContent = shapes[index].text);
        layer.dataset.columns = String(density);
      }
      const footer = layer.closest('footer');
      const word = footer.querySelector('svg[data-framer-component-type="RichTextContainer"]');
      const content = footer.querySelector(':scope > [data-framer-name="Container"]');
      // Keep the hands at their established scale when the watermark gap changes.
      const spacing = parseFloat(getComputedStyle(footer).getPropertyValue('--footer-art-spacing')) || 0;
      const available = content ? content.getBoundingClientRect().bottom - footer.getBoundingClientRect().top + 48 + spacing
        : word ? word.getBoundingClientRect().top - footer.getBoundingClientRect().top - 16 : footer.clientHeight * .55;
      layer.style.height = Math.max(160, available) + 'px';
      const cell = Math.min(layer.clientWidth * .44 / density, layer.clientHeight / (Math.max(...shapes.map(s => s.rows)) * 1.25));
      layer.style.setProperty('--hand-cell', cell + 'px');
    });
    updateTargets();
  }
  function paint(time) {
    frame = 0;
    const elapsed = previousTime ? Math.min(64, time - previousTime) : 1000 / 60;
    previousTime = time;
    // Time-based damping keeps the same soft movement across refresh rates.
    const blend = 1 - Math.exp(-elapsed / 160);
    let moving = false;
    motion.forEach(state => {
      state.progress = reduce.matches ? state.target : state.progress + (state.target - state.progress) * blend;
      if (Math.abs(state.target - state.progress) < .0005) state.progress = state.target;
      else moving = true;
      // Ease both ends so hands arrive and leave without an abrupt stop.
      const progress = state.progress * state.progress * (3 - 2 * state.progress);
      state.layer.style.setProperty('--hands-offset', ((1 - progress) * 105) + '%');
      state.layer.style.setProperty('--hands-enter-opacity', Math.min(1, progress * 2));
    });
    if (moving && !document.hidden) frame = requestAnimationFrame(paint);
    else previousTime = 0;
  }
  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
  }
  function updateTargets() {
    motion.forEach(state => {
      const { layer } = state;
      const footer = layer.closest('footer');
      const rect = footer.getBoundingClientRect();
      const distance = Math.min(innerHeight * .65, footer.clientHeight * .8);
      state.target = reduce.matches ? 1 : Math.max(0, Math.min(1, (innerHeight - rect.top) / distance));
    });
    schedule();
  }
  window.addEventListener('scroll', updateTargets, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  reduce.addEventListener('change', updateTargets);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
    else updateTargets();
  });
  document.fonts.ready.then(layout);
  layout();
}
