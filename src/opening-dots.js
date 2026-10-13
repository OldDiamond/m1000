// Opening sequence: scattered dots → name → grid → expanding dots → page.
// All artwork is rendered locally; the reference site is not a dependency.
const layer = document.getElementById('portfolio-opening');
if (layer && !layer.hidden) startOpening(layer).catch(() => {
  clearTimeout(layer.failsafe);
  document.documentElement.classList.remove('opening-dots-active');
  layer.remove();
});

async function startOpening(layer) {
  const canvas = layer.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = Number(layer.dataset.duration);
  const page = document.getElementById('main');
  const previousInert = page?.inert;
  let frame = 0, previousTime = 0, elapsed = 0, finished = false;
  let width, height, side, columns, particles;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
  const random = seed => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(layer.failsafe);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    reduce.removeEventListener('change', finish);
    if (page) page.inert = previousInert;
    document.documentElement.classList.remove('opening-dots-active');
    layer.remove();
  }
  function onKey(event) { if (event.key === 'Escape') finish(); }
  layer.finish = finish;
  function onVisibility() {
    previousTime = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else if (!finished && !frame) frame = requestAnimationFrame(paint);
  }

  // Bound font waiting so a slow font cannot keep visitors behind the intro.
  await Promise.race([document.fonts.load('500 100px Archivo').catch(() => {}), new Promise(resolve => setTimeout(resolve, 700))]);
  if (!layer.isConnected || reduce.matches) { finish(); return; }
  if (page) page.inert = true;

  function resize() {
    width = innerWidth; height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    side = Math.min(height * .6, width * .88);
    columns = width <= 600 ? 16 : 18;
    const count = columns * columns;
    const mask = document.createElement('canvas');
    const ctx = mask.getContext('2d', {willReadFrequently: true});
    ctx.font = '500 100px Archivo, Arial, sans-serif';
    mask.width = Math.ceil(ctx.measureText(layer.dataset.text).width) + 16;
    mask.height = 150;
    ctx.font = '500 100px Archivo, Arial, sans-serif';
    ctx.textBaseline = 'middle'; ctx.fillText(layer.dataset.text, 8, 75);
    const pixels = ctx.getImageData(0, 0, mask.width, mask.height).data;
    let targets = [];
    // Keep the dotted letters distinct, with a bounded particle count.
    for (let spacing = 3; spacing <= 24; spacing++) {
      targets = [];
      for (let y = Math.floor(spacing / 2); y < mask.height; y += spacing) {
        for (let x = Math.floor(spacing / 2); x < mask.width; x += spacing) {
          if (pixels[(y * mask.width + x) * 4 + 3] > 128) targets.push({x: x - mask.width / 2, y: y - 75});
        }
      }
      if (targets.length && targets.length <= count) break;
    }
    if (!targets.length) { finish(); return; }
    const textScale = Math.min(width * (width <= 600 ? .8 : .36), 440, side * .95) / mask.width;
    particles = Array.from({length: count}, (_, index) => {
      const target = targets[index % targets.length];
      return {
        startX: random(index + 1) - .5, startY: random(index + 907) - .5,
        textX: target.x * textScale, textY: target.y * textScale,
        gridX: ((index % columns) + .5) / columns - .5,
        gridY: (Math.floor(index / columns) + .5) / columns - .5,
        delay: random(index + 2017), radius: .8 + random(index + 4099) * .35
      };
    });
  }

  function paint(time) {
    frame = 0;
    if (finished || !layer.isConnected) { finish(); return; }
    if (previousTime) elapsed += Math.min(64, time - previousTime);
    previousTime = time;
    const phase = elapsed / duration;
    if (phase >= 1) { finish(); return; }
    layer.dataset.phase = phase < .44 ? 'name' : phase < .72 ? 'grid' : phase < .88 ? 'expand' : 'reveal';
    layer.style.opacity = String(1 - smooth((phase - .88) / .12));
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.rect((width - side) / 2, (height - side) / 2, side, side);
    context.clip();
    context.fillStyle = '#111';
    context.globalAlpha = smooth(phase / .05);
    context.beginPath();
    for (const dot of particles) {
      const gather = smooth((phase - .04 - dot.delay * .1) / .2);
      const spread = smooth((phase - .44 - dot.delay * .08) / .16);
      const grow = smooth((phase - .72 - dot.delay * .04) / .1);
      const nameX = dot.startX * side + (dot.textX - dot.startX * side) * gather;
      const nameY = dot.startY * side + (dot.textY - dot.startY * side) * gather;
      const x = width / 2 + nameX + (dot.gridX * side - nameX) * spread;
      const y = height / 2 + nameY + (dot.gridY * side - nameY) * spread;
      const radius = dot.radius + (side / columns * .76 - dot.radius) * grow;
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
    context.fill();
    context.restore();
    frame = requestAnimationFrame(paint);
  }

  try {
    resize();
    if (finished) return;
    window.addEventListener('resize', resize, {passive: true});
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    reduce.addEventListener('change', finish);
    if (!document.hidden) frame = requestAnimationFrame(paint);
  } catch (error) { finish(); throw error; }
}
