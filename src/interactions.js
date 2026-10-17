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
  const desktop = matchMedia('(min-width: 810px)');
  let open = false;
  function toggle(next, returnFocus = false) {
    open = !desktop.matches && next;
    const visible = desktop.matches || open;
    panel.classList.toggle('is-open', open);
    menu.inert = !visible;
    menu.setAttribute('aria-hidden', String(!visible));
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) trigger.focus();
  }
  settings.navigation.forEach((item, index) => {
    const link = document.createElement('a');
    link.href = item.href;
    if (item.href.endsWith('#contact')) link.classList.add('portfolio-contact-link');
    const destination = new URL(item.href, location.href);
    if (!destination.hash && (destination.pathname.replace(/\/+$/, '') || '/') === (location.pathname.replace(/\/+$/, '') || '/')) link.setAttribute('aria-current', 'page');
    link.setAttribute('aria-label', item.label);
    link.style.setProperty('--menu-index', index);
    link.append(rollingLabel(item.label));
    link.addEventListener('click', () => toggle(false));
    links.append(link);
  });
  menu.append(links);
  toggle(false);
  desktop.addEventListener('change', () => toggle(false));
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
      const mark = footer.querySelector('.footer-mark');
      if (mark) {
        if (innerWidth < 1280) footer.querySelector('[data-framer-name="Columns"]').before(mark);
        else footer.querySelector('[data-framer-name="Quick Links"]').prepend(mark);
      }
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
  const heroTitle = group?.querySelector('#hero-section h1');
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
  const theme = getComputedStyle(document.documentElement);
  const quoteActive = theme.getPropertyValue('--quote-active').trim() || '#111';
  const quoteInactive = theme.getPropertyValue('--quote-inactive').trim() || 'rgba(0,0,0,.14)';
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
      let entranceY = avatar.offsetHeight * .05;
      if (desktop && heroTitle && front) {
        const faceTop = avatar.getBoundingClientRect().top + front.offsetTop + front.offsetHeight * .25;
        entranceY = Math.max(entranceY, heroTitle.getBoundingClientRect().bottom + 36 - faceTop);
      }
      const y = desktop ? entranceY * (animated ? 1 - progress : 1) : 0;
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
        const color = index / words.length < reveal ? quoteActive : quoteInactive;
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
  const title = document.querySelector('#hero-section [data-framer-name="Title"]');
  const lines = title?.querySelectorAll('.hero-title-line');
  const star = title?.querySelector('[data-hero-decoration="star"]');
  const lightning = title?.querySelector('[data-hero-decoration="lightning"]');
  if (title && lines?.length && star && lightning) {
    const align = () => {
      title.style.setProperty('--hero-first-half-width', lines[0].offsetWidth / 2 + 'px');
      title.style.setProperty('--hero-first-line-height', lines[0].offsetHeight + 'px');
      title.style.setProperty('--hero-last-half-width', lines[lines.length - 1].offsetWidth / 2 + 'px');
      title.style.setProperty('--hero-star-width', star.offsetWidth + 'px');
      title.style.setProperty('--hero-lightning-width', lightning.offsetWidth + 'px');
    };
    const observer = new ResizeObserver(align);
    [title, ...lines, star, lightning].forEach(element => observer.observe(element));
    document.fonts.ready.then(align);
    align();
  }
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

function setupArticleHover() {
  document.querySelectorAll('a.framer-6Ku2B').forEach(card => {
    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') card.classList.add('is-hovered');
    });
    const leave = () => card.classList.remove('is-hovered');
    card.addEventListener('pointerleave', leave);
    card.addEventListener('pointercancel', leave);
  });
}

function setupForms(settings) {
  document.querySelectorAll('form').forEach(form => {
    form.querySelectorAll('input[aria-hidden="true"]:not([name="_honey"])').forEach(input => input.remove());
    const newsletter = !form.hasAttribute('data-contact-form') && form.querySelectorAll('input:not([type="hidden"])').length === 1;
    if (newsletter) {
      form.removeAttribute('action');
      const input = form.querySelector('input[type="email"]');
      input?.setAttribute('aria-label', 'Email address');
      input?.setAttribute('autocomplete', 'email');
    }
    const endpoint = newsletter ? settings.newsletterEndpoint : settings.contactEndpoint;
    const formSubmit = !newsletter && /^https:\/\/formsubmit\.co\/ajax\//.test(endpoint || '');
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    let sending = false;
    const feedback = document.createElement('p');
    feedback.className = 'form-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    feedback.hidden = true;
    if (newsletter) form.after(feedback);
    else form.append(feedback);
    const secureRetry = formSubmit ? document.createElement('button') : null;
    if (secureRetry) {
      secureRetry.type = 'button';
      secureRetry.className = 'form-secure-retry';
      secureRetry.textContent = 'Continue with secure form';
      secureRetry.hidden = true;
      form.append(secureRetry);
      secureRetry.addEventListener('click', () => {
        if (sending) return;
        form.querySelectorAll('input[name="name"],input[name="email"],textarea[name="message"]').forEach(input => input.value = input.value.trim());
        if (!form.reportValidity()) return;
        if (form.elements.namedItem('_honey')?.value) return;
        // A normal POST lets FormSubmit display its verification page when needed.
        for (const [name, value] of Object.entries({ _url: location.origin + location.pathname, _replyto: form.elements.namedItem('email').value })) {
          let field = form.querySelector(`input[name="${name}"]`);
          if (!field) { field = document.createElement('input'); field.type = 'hidden'; field.name = name; form.append(field); }
          field.value = value;
        }
        HTMLFormElement.prototype.submit.call(form);
      });
    }
    function showFeedback(message, state, { email = false, retry = false } = {}) {
      feedback.hidden = false;
      feedback.dataset.state = state;
      feedback.replaceChildren(document.createTextNode(message));
      if (email) {
        const link = document.createElement('a');
        link.href = 'mailto:' + settings.contactEmail;
        link.textContent = settings.contactEmail;
        feedback.append(' ', link);
      }
      if (secureRetry) secureRetry.hidden = !retry;
    }
    form.querySelectorAll('input[type="email"]').forEach(input => input.required = true);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending) return;
      if (!newsletter) form.querySelectorAll('input[name="name"],input[name="email"],textarea[name="message"]').forEach(input => input.value = input.value.trim());
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      if (data._honey) return;
      if (!endpoint) {
        if (newsletter) {
          showFeedback('Newsletter signup is not connected yet.', 'error');
          return;
        }
        const body = Object.entries(data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => key + ': ' + value).join('\n');
        window.location.href = 'mailto:' + settings.contactEmail + '?subject=' + encodeURIComponent('Portfolio project enquiry') + '&body=' + encodeURIComponent(body);
        showFeedback('Your email app will open with your enquiry. Send it there to complete your message.', 'info');
        return;
      }
      const payload = formSubmit ? {
        name: data.name, email: data.email, message: data.message,
        _replyto: data.email, _subject: 'New portfolio enquiry - ' + settings.displayName,
        _template: 'table', _url: location.origin + location.pathname, _honey: ''
      } : data;
      sending = true;
      form.classList.add('portfolio-form-busy');
      form.setAttribute('aria-busy', 'true');
      buttons.forEach(button => button.disabled = true);
      showFeedback(newsletter ? 'Subscribing...' : 'Sending your enquiry...', 'sending');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST', headers: formSubmit ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: formSubmit ? new URLSearchParams(payload) : JSON.stringify(payload), signal: controller.signal
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.success === false || result?.success === 'false' || (formSubmit && result?.success !== true && result?.success !== 'true')) {
          const error = new Error('Submission failed');
          const message = typeof result?.message === 'string' ? result.message : '';
          error.reason = response.status === 429 ? 'rate-limit' : /activat|confirm.{0,40}email|verify.{0,40}email/i.test(message) ? 'activation' : /captcha|verification/i.test(message) ? 'verification' : 'provider';
          throw error;
        }
        showFeedback(newsletter ? 'You are subscribed.' : 'Thank you. Your enquiry has been submitted.', 'success');
        form.reset();
      } catch (error) {
        if (error.reason === 'activation') {
          showFeedback('This contact form is awaiting email activation. Please email me directly:', 'error', { email: true });
        } else if (error.reason === 'rate-limit') {
          showFeedback('Too many attempts. Please wait a few minutes or email me:', 'error', { email: true });
        } else {
          const message = error.reason === 'verification' ? 'Please continue with the secure form to complete verification, or email me:'
            : controller.signal.aborted ? 'The request timed out; delivery could not be confirmed. You can use the secure form or email me:'
            : formSubmit ? 'The email service could not complete this request. You can use the secure form or email me:'
            : 'Could not send. Please try again or email';
          showFeedback(message, 'error', { email: true, retry: Boolean(secureRetry) });
        }
      } finally {
        clearTimeout(timeout);
        sending = false;
        form.classList.remove('portfolio-form-busy');
        form.removeAttribute('aria-busy');
        buttons.forEach(button => button.disabled = false);
      }
    });
  });
}

async function setup() {
  const embeddedSettings = document.getElementById('portfolio-settings');
  const settings = embeddedSettings ? JSON.parse(embeddedSettings.textContent) : await fetch('/assets/settings.json').then(response => response.json());
  setupCurtain(settings.backgroundCurtains);
  setupNavigation(settings);
  setupFooter(settings);
  setupFooterMark();
  setupFooterHands(settings.footerHands);
  setupScrollMotion(settings);
  setupDecorations();
  setupArticleHover();
  setupForms(settings);
  const socialNames = ['Gmail: m1000zurich@gmail.com', 'Instagram', 'LinkedIn'];
  document.querySelectorAll('[data-framer-name="Social Media Icons"] a').forEach((link, index) => {
    link.setAttribute('aria-label', socialNames[index] || 'Social profile');
    link.rel = 'noopener noreferrer';
  });
}

setup().catch(console.error);
