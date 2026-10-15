import { setupCurtain } from './curtain.js';
import { setupFooterHands } from './footer-hands.js';
import { setupFooterMark } from './footer-mark.js';
import { setupPageMotion } from './page-motion.js';

setupPageMotion();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function rollingLabel(text) {
  const label = document.createElement('span');
  label.className = 'rolling-label';
  label.setAttribute('aria-hidden', 'true');
  [...text].forEach((letter, index) => {
    const span = document.createElement('span');
    span.textContent = letter;
    span.style.setProperty('--letter-index', index);
    label.append(span);
  });
  return label;
}

function setupNavigation(settings) {
  const panel = document.querySelector('.portfolio-nav');
  const menu = document.querySelector('#portfolio-menu');
  const trigger = document.querySelector('.portfolio-toggle');
  if (!panel || !menu || !trigger) return;
  const links = document.createElement('div');
  links.className = 'portfolio-menu-links';
  let open = false;
  function toggle(next, returnFocus = false) {
    open = next;
    panel.classList.toggle('is-open', open);
    menu.inert = !open;
    menu.setAttribute('aria-hidden', String(!open));
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) trigger.focus();
  }
  settings.navigation.forEach((item, index) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.setAttribute('aria-label', item.label);
    link.style.setProperty('--menu-index', index);
    link.append(rollingLabel(item.label));
    link.addEventListener('click', () => toggle(false));
    links.append(link);
  });
  menu.append(links);
  trigger.addEventListener('click', () => toggle(!open));
  document.addEventListener('click', event => {
    if (open && !panel.contains(event.target)) toggle(false);
  });
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') toggle(false, true);
  });
  document.addEventListener('focusin', event => {
    if (open && !panel.contains(event.target)) toggle(false);
  });
}

function setupFooter(settings) {
  const footers = document.querySelectorAll('footer');
  footers.forEach(footer => {
    footer.querySelectorAll('a p[class*="rolling-text-inner-"]').forEach(label => {
      const text = label.textContent.trim();
      const link = label.closest('a');
      link.setAttribute('aria-label', text);
      label.setAttribute('aria-hidden', 'true');
      label.classList.add('rolling-label', 'footer-link-label');
      label.replaceChildren(...rollingLabel(text).childNodes);
    });
  });
  const measure = document.createElement('canvas').getContext('2d');
  function fitWordmarks() {
    footers.forEach(footer => {
      const word = footer.querySelector('[data-brand-wordmark]');
      const label = word?.querySelector('p');
      if (!label || !measure) return;
      const style = getComputedStyle(label);
      measure.font = `${style.fontWeight} 100px ${style.fontFamily}`;
      const tracking = parseFloat(style.letterSpacing) / parseFloat(style.fontSize) || 0;
      const width = measure.measureText(label.textContent).width + Math.max(0, label.textContent.length - 1) * tracking * 100;
      const size = Math.min(416.95, 1180 / Math.max(1, width) * 100);
      label.style.setProperty('--framer-font-size', size + 'px');
      word.setAttribute('viewBox', `0 0 1200 ${size * .9}`);
      // Keep three quarters visible, with room above for the footer links.
      footer.style.paddingBottom = Math.ceil(word.getBoundingClientRect().height * .75 + 64) + 'px';
    });
  }
  const layout = () => {
    const variant = innerWidth >= 1280 ? '788ly6' : innerWidth >= 810 ? '1w2xgsd' : '1s9g854';
    footers.forEach(footer => {
      footer.classList.remove('framer-v-788ly6', 'framer-v-1w2xgsd', 'framer-v-1s9g854');
      footer.classList.add('framer-v-' + variant);
    });
    fitWordmarks();
  };
  layout();
  document.fonts.ready.then(fitWordmarks);
  window.addEventListener('resize', layout, { passive: true });
  footers.forEach(footer => footer.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    link.href = 'mailto:' + settings.contactEmail;
    link.textContent = settings.contactEmail;
  }));
}

function setupScrollMotion(settings) {
  const group = document.querySelector('[data-framer-name="Hero & Bio Sections"]');
  const avatar = group?.querySelector('[data-framer-name="Avatar Wrap"]');
  const front = avatar?.querySelector('[data-framer-name="Avatar - Front"]');
  const back = avatar?.querySelector('[data-framer-name="Avatar - Back"]');
  const quoteSection = document.querySelector('[data-framer-name="Quote Section"]');
  const quoteSticky = quoteSection?.querySelector('[data-framer-name="Content"]');
  const quoteParent = quoteSection?.querySelector('span')?.parentElement;
  if (quoteParent && settings.quote) {
    const style = quoteParent.firstElementChild.getAttribute('style');
    quoteParent.replaceChildren(...settings.quote.split(/\s+/).map(word => {
      const span = document.createElement('span');
      span.textContent = word;
      span.setAttribute('style', style);
      return span;
    }));
  }
  const words = [...(quoteParent?.children || [])];
  const clamp = value => Math.max(0, Math.min(1, value));
  let frame = 0;
  let progress = group ? clamp(-group.getBoundingClientRect().top / innerHeight) : 0;
  function paint() {
    frame = 0;
    const target = group ? clamp(-group.getBoundingClientRect().top / innerHeight) : 0;
    const animated = innerWidth >= 1280 && !reducedMotion.matches;
    progress = animated ? progress + (target - progress) * .18 : 1;
    if (Math.abs(target - progress) < .0005 && animated) progress = target;
    if (front && back) {
      const desktop = innerWidth >= 1280;
      const scale = desktop ? .5 + (animated ? progress * .5 : 0) : 1;
      const y = desktop ? avatar.offsetHeight * .25 * (animated ? 1 - progress : 1) : 0;
      const angle = animated ? progress * 180 : 0;
      const base = `perspective(1200px) translateY(${y}px) scale(${scale})`;
      front.style.transform = `${base} rotateY(${angle}deg)`;
      back.style.transform = `${base} rotateY(${angle - 180}deg)`;
    }
    if (quoteSection && words.length) {
      const stickyRect = quoteSticky?.getBoundingClientRect();
      const containerRect = quoteSticky?.parentElement.getBoundingClientRect();
      // Begin at the first word only once the paragraph is centered and pinned.
      // Use the full sticky distance so it cannot finish while entering view.
      const pinnedTravel = stickyRect ? Math.max(0, stickyRect.top - containerRect.top) : 0;
      const revealDistance = stickyRect ? Math.max(1, containerRect.height - stickyRect.height) : 1;
      const reveal = reducedMotion.matches ? 1 : clamp(pinnedTravel / revealDistance);
      words.forEach((word, index) => {
        const color = index / words.length < reveal ? '#111' : 'rgba(0,0,0,.14)';
        if (word.dataset.revealed !== color) {
          word.style.color = color;
          word.dataset.revealed = color;
        }
      });
    }
    if (animated && Math.abs(target - progress) >= .0005) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
  paint();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', schedule);
}

function setupDecorations() {
  document.querySelectorAll('[data-framer-name="holo_triangle_rounded"]').forEach((shape, index) => {
    const rotation = index === 0 ? 16 : 0;
    let x = 0, y = 0, vx = 0, vy = 0, frame = 0, drag = null;
    shape.classList.add('draggable-decoration');
    shape.setAttribute('role', 'img');
    shape.setAttribute('aria-label', (index === 0 ? 'Metallic lightning shape' : 'Metallic star') + '. Drag to move, use arrow keys to reposition, or Escape to reset.');
    shape.querySelectorAll('img').forEach(image => image.draggable = false);
    const paint = () => { shape.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`; };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; vx = vy = 0; };
    function coast(time) {
      const dt = Math.min(time - dragTime, 64);
      dragTime = time;
      x += vx * dt;
      y += vy * dt;
      const damping = Math.exp(-dt / 325);
      vx *= damping;
      vy *= damping;
      paint();
      frame = Math.hypot(vx, vy) > .01 ? requestAnimationFrame(coast) : 0;
    }
    let dragTime = 0;
    shape.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      stop();
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, lastX: event.clientX, lastY: event.clientY, time: performance.now() };
      shape.setPointerCapture(event.pointerId);
      shape.classList.add('is-dragging');
    });
    shape.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const now = performance.now();
      const dt = Math.max(now - drag.time, 1);
      vx = vx * .4 + (event.clientX - drag.lastX) / dt * .6;
      vy = vy * .4 + (event.clientY - drag.lastY) / dt * .6;
      x = drag.x + event.clientX - drag.startX;
      y = drag.y + event.clientY - drag.startY;
      Object.assign(drag, { lastX: event.clientX, lastY: event.clientY, time: now });
      paint();
    });
    function release(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const idle = performance.now() - drag.time;
      drag = null;
      shape.classList.remove('is-dragging');
      if (shape.hasPointerCapture(event.pointerId)) shape.releasePointerCapture(event.pointerId);
      if (event.type !== 'pointercancel' && !reducedMotion.matches && idle < 100) {
        dragTime = performance.now();
        frame = requestAnimationFrame(coast);
      } else stop();
    }
    shape.addEventListener('pointerup', release);
    shape.addEventListener('pointercancel', release);
    shape.addEventListener('lostpointercapture', event => {
      if (drag && drag.id === event.pointerId) { drag = null; shape.classList.remove('is-dragging'); stop(); }
    });
    shape.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!directions[event.key] && event.key !== 'Escape') return;
      event.preventDefault();
      stop();
      if (event.key === 'Escape') x = y = 0;
      else { const step = event.shiftKey ? 30 : 10; x += directions[event.key][0] * step; y += directions[event.key][1] * step; }
      paint();
    });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(); });
    paint();
  });
}

function setupForms(settings) {
  document.querySelectorAll('form').forEach(form => {
    form.querySelectorAll('input[aria-hidden="true"]').forEach(input => input.remove());
    form.querySelectorAll('textarea').forEach(input => input.name = 'Project');
    form.removeAttribute('action');
    const newsletter = form.querySelectorAll('input:not([type="hidden"])').length === 1;
    const endpoint = newsletter ? settings.newsletterEndpoint : settings.contactEndpoint;
    const feedback = document.createElement('p');
    feedback.className = 'form-feedback';
    feedback.setAttribute('role', 'status');
    form.after(feedback);
    form.querySelectorAll('input[type="email"]').forEach(input => input.required = true);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      if (!endpoint) {
        if (newsletter) {
          feedback.textContent = 'Newsletter signup is not connected yet.';
          return;
        }
        const body = Object.entries(data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => key + ': ' + value).join('\n');
        window.location.href = 'mailto:' + settings.contactEmail + '?subject=' + encodeURIComponent('Portfolio project enquiry') + '&body=' + encodeURIComponent(body);
        feedback.textContent = 'Your email app will open with your enquiry. Send it there to complete your message.';
        return;
      }
      form.classList.add('portfolio-form-busy');
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!response.ok) throw new Error('Submission failed');
        feedback.textContent = newsletter ? 'You are subscribed.' : 'Thank you. Your enquiry has been sent.';
        form.reset();
      } catch {
        feedback.textContent = 'Could not send. Please try again or email ' + settings.contactEmail;
      } finally {
        form.classList.remove('portfolio-form-busy');
      }
    });
  });
}

async function setup() {
  const settings = await fetch('/assets/settings.json').then(response => response.json());
  setupCurtain(settings.backgroundCurtains);
  setupNavigation(settings);
  setupFooter(settings);
  setupFooterMark();
  setupFooterHands(settings.footerHands);
  setupScrollMotion(settings);
  setupDecorations();
  setupForms(settings);
  const socialNames = ['X', 'Instagram', 'LinkedIn', 'YouTube'];
  document.querySelectorAll('[data-framer-name="Social Media Icons"] a').forEach((link, index) => {
    link.setAttribute('aria-label', socialNames[index] || 'Social profile');
    link.rel = 'noopener noreferrer';
  });
}

setup().catch(console.error);
