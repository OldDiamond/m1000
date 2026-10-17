// Paint the strands once; the browser composites their movement without a draw loop.
export function setupAboutLightTrails(options = {}) {
  const layer = document.querySelector('.about-light-trails');
  if (!layer) return;
  if (options.enabled === false) { layer.hidden = true; return; }
  const canvases = [...layer.querySelectorAll('canvas')];
  const brushes = canvases.map(canvas => canvas.getContext('2d'));
  if (brushes.some(brush => !brush)) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const speed = Math.max(0, Math.min(2, Number(options.speed ?? .35)));
  const intensity = Math.max(0, Math.min(1, Number(options.intensity ?? .82)));
  const rgb = (hex, fallback) => /^#[0-9a-f]{6}$/i.test(hex || '')
    ? [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) : fallback;
  const primary = rgb(options.primaryColor, [180, 63, 77]);
  const accent = rgb(getComputedStyle(layer).getPropertyValue('--theme-accent').trim(), [223, 114, 120]);
  const ink = (color, alpha) => `rgba(${color.join(',')},${alpha})`;
  let width = 0, height = 0, ratio = 1, visible = true;
  layer.style.setProperty('--about-trail-duration', 20 * .35 / (speed || .35) + 's');

  function pathFor(index, offset = 0) {
    const path = new Path2D();
    for (let step = 0; step <= 72; step++) {
      const progress = step / 72;
      const x = width * (-.15 + progress * 1.3);
      const bend = Math.pow(progress, 2.1) * height * .48;
      const ripple = Math.sin(progress * 5.5 + index * 1.7) * height * .018;
      const y = height * (index ? .66 : .25) + bend + ripple + offset;
      if (step) path.lineTo(x, y); else path.moveTo(x, y);
    }
    return path;
  }

  function createBand(index) {
    const brush = brushes[index];
    brush.scale(ratio, ratio);
    brush.globalAlpha = intensity * (index ? .75 : .85);
    const thickness = Math.min(110, Math.max(56, height * .075));
    const path = pathFor(index);
    const glow = brush.createLinearGradient(0, 0, width, height * .35);
    glow.addColorStop(0, ink(primary, .03));
    glow.addColorStop(.32, ink(primary, .15));
    glow.addColorStop(.7, ink(accent, .12));
    glow.addColorStop(1, ink(primary, .02));
    brush.strokeStyle = glow;
    brush.lineWidth = thickness * .95;
    brush.shadowColor = ink(primary, .24);
    brush.shadowBlur = 30;
    brush.stroke(path);
    brush.shadowBlur = 0;
    for (let strand = 0; strand < 100; strand++) {
      const offset = (strand / 99 - .5) * thickness;
      const core = Math.exp(-Math.pow(offset / (thickness * .12), 2));
      const grain = .45 + .55 * Math.sin(strand * 31.17) ** 2;
      const light = brush.createLinearGradient(-width * .15, 0, width * 1.15, 0);
      light.addColorStop(0, ink(primary, .04 * grain));
      light.addColorStop(.25, ink(primary, (.09 + core * .22) * grain));
      light.addColorStop(.58, ink(accent, (.1 + core * .28) * grain));
      light.addColorStop(.86, ink(primary, (.06 + core * .14) * grain));
      light.addColorStop(1, ink(primary, 0));
      brush.strokeStyle = light;
      brush.lineWidth = .6 + grain * .8;
      brush.stroke(pathFor(index, offset + Math.sin(strand * 2.13) * 1.5));
    }
  }

  function updateMotion() {
    layer.dataset.active = String(!document.hidden && visible && !reduce.matches && speed > 0);
  }
  function resize() {
    const nextWidth = layer.clientWidth, nextHeight = layer.clientHeight;
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth; height = nextHeight;
    if (!width || !height) return;
    ratio = Math.min(devicePixelRatio || 1, 1.25, 1600 / width, 1600 / height);
    canvases.forEach((canvas, index) => {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      createBand(index);
    });
    layer.dataset.renderer = 'canvas';
    updateMotion();
  }
  new ResizeObserver(resize).observe(layer);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateMotion(); }).observe(layer);
  document.addEventListener('visibilitychange', updateMotion);
  reduce.addEventListener('change', updateMotion);
  resize();
}
