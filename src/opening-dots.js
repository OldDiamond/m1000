// Opening sequence: scattered dots → name → grid → hero text and portrait.
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
  let width, height, side, columns, particles, headingMask, headingDots, portrait, heroCaptured = false;
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

  // Decode the hero photograph while preparing the dots, before the reveal.
  // Bound waiting so unavailable assets cannot hold visitors behind the intro.
  const portraitImages = [...document.querySelectorAll('[data-framer-name="Avatar - Front"] img, [data-framer-name="Avatar - Back"] img')];
  const assetsReady = Promise.allSettled([
    document.fonts.load('500 100px Archivo'),
    ...portraitImages.map(image => { image.loading = 'eager'; return image.decode(); })
  ]);
  await Promise.race([assetsReady, new Promise(resolve => setTimeout(resolve, 700))]);
  if (!layer.isConnected || reduce.matches) { finish(); return; }
  if (page) page.inert = true;

  function resize() {
    // The stable scrollbar gutter can make this layer narrower than the
    // viewport. Match its real size so masks do not scale away from the DOM.
    width = canvas.clientWidth; height = canvas.clientHeight;
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
    assignHeroTargets();
  }

  function assignHeroTargets() {
    const hero = heroTargets();
    const headingCount = particles.length - (hero.portrait ? 64 : 0);
    particles.forEach((dot, index) => {
      dot.isPortrait = index >= headingCount;
      const cell = index - headingCount;
      const point = hero.points[Math.floor(index * hero.points.length / headingCount) % hero.points.length];
      dot.heroX = dot.isPortrait ? portrait.x + ((cell % 8) + .5) * portrait.width / 8 : point?.x ?? width / 2;
      dot.heroY = dot.isPortrait ? portrait.y + (Math.floor(cell / 8) + .5) * portrait.height / 8 : point?.y ?? height / 2;
    });
    // Keep settled text dots inside the actual letters, including their edges.
    headingDots = document.createElement('canvas');
    headingDots.width = canvas.width; headingDots.height = canvas.height;
    const ctx = headingDots.getContext('2d');
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    for (const dot of particles) {
      if (dot.isPortrait) continue;
      ctx.moveTo(dot.heroX + dot.radius, dot.heroY);
      ctx.arc(dot.heroX, dot.heroY, dot.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(headingMask, 0, 0);
  }

  function heroTargets() {
    // Sample the rendered letters individually, preserving real line wraps,
    // font size, and tracking instead of approximating the heading's layout.
    headingMask = document.createElement('canvas');
    headingMask.width = width; headingMask.height = height;
    const ctx = headingMask.getContext('2d', {willReadFrequently: true});
    const heading = document.querySelector('#hero-section h1');
    const walker = heading && document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    let node;
    while (walker && (node = walker.nextNode())) {
      const style = getComputedStyle(node.parentElement);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      for (let index = 0; index < node.length; index++) {
        const letter = node.textContent[index];
        if (/\s/.test(letter)) continue;
        const range = document.createRange();
        range.setStart(node, index); range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        const metrics = ctx.measureText(letter);
        const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * .8;
        const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * .2;
        ctx.fillText(letter, rect.left, rect.top + (rect.height - ascent - descent) / 2 + ascent);
      }
    }
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const points = [];
    const spacing = width <= 600 ? 4 : 8;
    for (let y = spacing / 2; y < height; y += spacing) {
      for (let x = spacing / 2; x < width; x += spacing) {
        if (pixels[(y * width + x) * 4 + 3] > 128) points.push({x, y});
      }
    }
    // Use the visible face's transformed bounds, including desktop scaling.
    const faces = [...document.querySelectorAll('[data-framer-name="Avatar - Front"], [data-framer-name="Avatar - Back"]')];
    const face = faces.find(element => {
      const transform = getComputedStyle(element).transform;
      return element.getBoundingClientRect().width && new DOMMatrixReadOnly(transform).m33 > 0;
    });
    const rect = face?.getBoundingClientRect();
    portrait = rect && rect.width && rect.bottom > 0 && rect.top < height ? {
      x: rect.left, y: rect.top, width: rect.width, height: rect.height,
      radius: (parseFloat(getComputedStyle(face).borderTopLeftRadius) || 0) * rect.width / face.offsetWidth
    } : null;
    return {points, portrait};
  }

  function paint(time) {
    frame = 0;
    if (finished || !layer.isConnected) { finish(); return; }
    if (previousTime) elapsed += Math.min(64, time - previousTime);
    previousTime = time;
    const phase = elapsed / duration;
    if (phase >= 1) { finish(); return; }
    // Other hero interactions and font loading can settle after startup.
    // Measure again at the handoff so the dots meet their final positions.
    if (phase >= .72 && !heroCaptured) { assignHeroTargets(); heroCaptured = true; }
    layer.dataset.phase = phase < .44 ? 'name' : phase < .72 ? 'grid' : phase < .94 ? 'blend' : 'reveal';
    layer.style.opacity = String(1 - smooth((phase - .94) / .06));
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#faf7f3';
    context.fillRect(0, 0, width, height);
    layer.dataset.renderer = 'canvas';
    context.save();
    if (phase < .72) {
      context.beginPath();
      context.rect((width - side) / 2, (height - side) / 2, side, side);
      context.clip();
    }
    context.fillStyle = '#111';
    const headingReveal = smooth((phase - .85) / .1);
    const portraitReveal = smooth((phase - .88) / .08);
    for (const isPortrait of [false, true]) {
      // The portrait hole already dissolves its dots. Fading them separately
      // exposes the paper between the dots and image, causing a bright flash.
      context.globalAlpha = smooth(phase / .05) * (isPortrait ? 1 : 1 - headingReveal);
      if (!isPortrait && phase >= .845) {
        context.drawImage(headingDots, 0, 0, width, height);
        continue;
      }
      context.save();
      if (isPortrait && portrait && phase >= .845) {
        // Land first, then expand inside the photograph's clean outline.
        context.beginPath();
        context.roundRect(portrait.x, portrait.y, portrait.width, portrait.height, portrait.radius);
        context.clip();
      }
      context.beginPath();
      for (const dot of particles) {
        if (dot.isPortrait !== isPortrait) continue;
        const gather = smooth((phase - .04 - dot.delay * .1) / .2);
        const spread = smooth((phase - .44 - dot.delay * .08) / .16);
        const blend = smooth((phase - .72 - dot.delay * .02) / .105);
        const nameX = dot.startX * side + (dot.textX - dot.startX * side) * gather;
        const nameY = dot.startY * side + (dot.textY - dot.startY * side) * gather;
        const gridX = width / 2 + nameX + (dot.gridX * side - nameX) * spread;
        const gridY = height / 2 + nameY + (dot.gridY * side - nameY) * spread;
        const x = gridX + (dot.heroX - gridX) * blend;
        const y = gridY + (dot.heroY - gridY) * blend;
        const targetRadius = isPortrait ? Math.max(portrait.width, portrait.height) / 8 * .74 : dot.radius;
        const grow = smooth((phase - .845) / .035);
        const radius = dot.radius + (targetRadius - dot.radius) * grow;
        context.moveTo(x + radius, y);
        context.arc(x, y, radius, 0, Math.PI * 2);
      }
      context.fill();
      context.restore();
    }
    context.restore();
    // Open the canvas onto the actual DOM, so the photograph and typography
    // meet the dots in place without a second image or layout approximation.
    context.save();
    context.globalCompositeOperation = 'destination-out';
    context.globalAlpha = headingReveal;
    context.drawImage(headingMask, 0, 0);
    if (portrait) {
      context.globalAlpha = portraitReveal;
      context.beginPath();
      context.roundRect(portrait.x, portrait.y, portrait.width, portrait.height, portrait.radius);
      context.fill();
    }
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
