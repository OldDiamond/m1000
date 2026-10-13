// ASCII silhouettes from the supplied footer reference, with scroll-only motion.
export async function setupFooterHands(options = {}) {
  const layers = [...document.querySelectorAll('.footer-hands')];
  if (!layers.length) return;
  if (options.enabled === false) { layers.forEach(layer => layer.hidden = true); return; }
  const columns = Math.max(40, Math.min(140, Number(options.columns) || 80));
  const pools = [' ', '.,:', '-~^:;', '+<>?!', '/\\()[]{}', '*#%@'];
  async function silhouette(src) {
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
  let shapes;
  try { shapes = await Promise.all([silhouette('/assets/hands/left.png'), silhouette('/assets/hands/right.png')]); }
  catch { layers.forEach(layer => layer.hidden = true); return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  layers.forEach(layer => {
    layer.style.setProperty('--hands-color', options.color || '#ff3b14');
    layer.style.setProperty('--hands-opacity', Math.max(0, Math.min(1, Number(options.opacity ?? .45))));
    layer.querySelectorAll('pre').forEach((pre, index) => pre.textContent = shapes[index].text);
    layer.dataset.ready = 'true';
  });
  function layout() {
    layers.forEach(layer => {
      const footer = layer.closest('footer');
      const word = footer.querySelector('svg[data-framer-component-type="RichTextContainer"]');
      const available = word ? word.getBoundingClientRect().top - footer.getBoundingClientRect().top - 16 : footer.clientHeight * .55;
      layer.style.height = Math.max(160, available) + 'px';
      const cell = Math.min(layer.clientWidth * .44 / columns, layer.clientHeight / (Math.max(...shapes.map(s => s.rows)) * 1.25));
      layer.style.setProperty('--hand-cell', cell + 'px');
    });
    paint();
  }
  let frame = 0;
  function paint() {
    frame = 0;
    layers.forEach(layer => {
      const footer = layer.closest('footer');
      const rect = footer.getBoundingClientRect();
      const distance = Math.min(innerHeight * .65, footer.clientHeight * .8);
      const progress = reduce.matches ? 1 : Math.max(0, Math.min(1, (innerHeight - rect.top) / distance));
      layer.style.setProperty('--hands-offset', ((1 - progress) * 105) + '%');
      layer.style.setProperty('--hands-enter-opacity', Math.min(1, progress * 2));
    });
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  reduce.addEventListener('change', schedule);
  document.fonts.ready.then(layout);
  layout();
}
