// A transparent curtain shader; the site's existing paper background shows through.
export function setupCurtain(options = {}) {
  const layer = document.querySelector('.curtain-background');
  if (!layer) return;
  if (options.enabled === false) { layer.hidden = true; return; }
  const primary = options.primaryColor || options.blue || '#b43f4d';
  const secondary = options.secondaryColor || options.violet || '#70212c';
  const strength = Math.max(0, Math.min(1, Number(options.intensity ?? .82)));
  const speed = Math.max(0, Math.min(2, Number(options.speed ?? .35)));
  layer.style.setProperty('--curtain-primary', primary);
  layer.style.setProperty('--curtain-secondary', secondary);
  layer.style.setProperty('--curtain-intensity', strength);
  const canvas = layer.querySelector('canvas');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) { layer.dataset.renderer = 'css'; return; }
  const vertexSource = `attribute vec2 a_position;
    varying vec2 v_uv;
    void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;
  const fragmentSource = `precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform float u_strength;
    uniform vec3 u_primary;
    uniform vec3 u_secondary;
    void main() {
      float down = 1. - v_uv.y;
      float sway = .014 * sin(down * 4.5 + u_time * .6)
                 + .009 * sin(down * 9. - u_time * .35);
      float x = v_uv.x + sway;
      float folds = .5 + .5 * sin(x * 83. + sin(x * 19. - u_time * .55) * 1.6);
      float fine = .5 + .5 * sin(x * 171. + down * 1.8 + u_time * .2);
      float light = .12 + .5 * pow(folds, 3.) + .27 * pow(folds, 18.) + .08 * pow(fine, 8.);
      float left = exp(-pow((v_uv.x - .04) / .20, 2.));
      float right = exp(-pow((v_uv.x - .96) / .20, 2.));
      float edges = min(1., left + right);
      float fade = (1. - smoothstep(.15, .92, down)) * exp(-down * .6);
      float halo = .13 * exp(-down * 5.);
      float alpha = u_strength * (light * edges + halo) * fade;
      vec3 color = mix(u_primary, u_secondary, .5 + .5 * sin(v_uv.x * 5. + u_time * .12));
      gl_FragColor = vec4(color, alpha);
    }`;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Curtain shader unavailable');
    }
    return shader;
  }
  let program;
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Curtain shader unavailable');
  } catch {
    layer.dataset.renderer = 'css';
    return;
  }
  gl.useProgram(program);
  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeUniform = gl.getUniformLocation(program, 'u_time');
  const rgb = hex => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    const value = parseInt(match ? match[1] : 'b43f4d', 16);
    return [(value >> 16 & 255)/255, (value >> 8 & 255)/255, (value & 255)/255];
  };
  gl.uniform3fv(gl.getUniformLocation(program, 'u_primary'), rgb(primary));
  gl.uniform3fv(gl.getUniformLocation(program, 'u_secondary'), rgb(secondary));
  gl.uniform1f(gl.getUniformLocation(program, 'u_strength'), strength);
  layer.dataset.renderer = 'webgl';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let epoch = performance.timeOrigin;
  try {
    const stored = Number(sessionStorage.getItem('portfolio-curtain-epoch'));
    epoch = stored > 0 && stored <= Date.now() ? stored : Date.now();
    sessionStorage.setItem('portfolio-curtain-epoch', String(epoch));
  } catch {}
  let frame = 0, lastRender = -Infinity, elapsed = Math.max(0, (Date.now() - epoch) / 1000), contextAvailable = true, inView = true;
  const draw = () => { if (contextAvailable) { gl.uniform1f(timeUniform, elapsed * speed); gl.drawArrays(gl.TRIANGLES, 0, 6); } };
  function resize() {
    if (!contextAvailable) return;
    const width = layer.clientWidth || innerWidth;
    const height = layer.clientHeight || innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / width);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }
  function animate(time) {
    frame = 0;
    if (document.hidden || reduce.matches || !speed || !contextAvailable || !inView) return;
    elapsed = Math.max(0, (Date.now() - epoch) / 1000);
    if (time - lastRender >= 1000 / 30) { draw(); lastRender = time; }
    frame = requestAnimationFrame(animate);
  }
  function restart() {
    cancelAnimationFrame(frame); frame = 0;
    draw();
    if (!document.hidden && !reduce.matches && speed && contextAvailable && inView) frame = requestAnimationFrame(animate);
  }
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', restart);
  reduce.addEventListener('change', restart);
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    restart();
  });
  observer.observe(layer);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextAvailable = false; cancelAnimationFrame(frame); frame = 0; layer.dataset.renderer = 'css';
  });
  resize(); restart();
}
