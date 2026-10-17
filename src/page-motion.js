// A continuous page handoff, followed by the existing word-by-word blur springs.
export function setupPageMotion() {
  window.__pageMotionReady = true;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeTransitions = 'onpagereveal' in window && 'onpageswap' in window;
  const navigation = window.__portfolioNavigation;
  const transitionReady = navigation?.ready || Promise.resolve(null);
  const revealReady = transitionReady.then(async transition => {
    await transition?.finished.catch(() => {});
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 500))]);
  });
  const animations = new Set();
  const headings = [...document.querySelectorAll('[data-page-reveal]')];
  const track = animation => {
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => {
      animations.delete(animation);
      animation.cancel();
    });
    return animation;
  };
  function reveal(heading) {
    if (heading.hasAttribute('data-reveal-played')) return;
    heading.setAttribute('data-reveal-played', '');
    if (reduced.matches || (heading.matches('#hero-section h1') && root.classList.contains('opening-dots-active'))) return;
    const hero = heading.dataset.pageReveal === 'hero';
    const intro = heading.dataset.pageReveal === 'intro';
    const blur = hero ? 2 : 10;
    const duration = hero ? 2800 : intro ? 800 : 1800;
    const stagger = hero ? 250 : 50;
    // Critically damped spring, settling to 0.1% at the reference duration.
    const frames = Array.from({ length: 91 }, (_, index) => {
      const t = index / 90;
      const remaining = index === 90 ? 0 : (1 + 9.2334 * t) * Math.exp(-9.2334 * t);
      return { offset: t, opacity: 1 - .999 * remaining,
        filter: `blur(${blur * remaining}px)`, transform: `translateY(${10 * remaining}px)` };
    });
    heading.querySelectorAll('[data-reveal-word]').forEach((word, index) => {
      track(word.animate(frames, { duration, delay: (intro ? 200 : 0) + index * stagger, fill: 'both', easing: 'linear' }));
    });
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        revealReady.then(() => reveal(entry.target));
      }
    });
  }, { threshold: 0 });
  if (reduced.matches) root.classList.remove('page-motion-enabled');
  else headings.forEach(heading => observer.observe(heading));

  function enter(transition) {
    if (transition || reduced.matches || !navigation?.pending || root.classList.contains('opening-dots-active')) {
      root.classList.remove('page-fallback-entering');
      return;
    }
    const page = document.getElementById('main');
    if (!page) { root.classList.remove('page-fallback-entering'); return; }
    const animation = page.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 250, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both'
    });
    animation.finished.catch(() => {}).then(() => root.classList.remove('page-fallback-entering'));
    track(animation);
  }
  transitionReady.then(enter);
  const path = value => value.replace(/\/+$/, '') || '/';
  function destinationFor(event) {
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
    const destination = new URL(link.href, location.href);
    return destination.origin === location.origin && /^https?:$/.test(destination.protocol) ? destination : null;
  }
  const prefetched = new Map();
  function warm(destination) {
    if (navigator.connection?.saveData || prefetched.size >= 8) return Promise.resolve();
    if (prefetched.has(destination.href)) return prefetched.get(destination.href);
    const request = fetch(destination.href, { credentials: 'same-origin', headers: { Accept: 'text/html' }, priority: 'low' })
      .then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(sheet => {
          const url = new URL(sheet.getAttribute('href'), destination);
          if (url.origin !== location.origin) return;
          const hint = document.createElement('link');
          hint.rel = 'prefetch'; hint.as = 'style'; hint.href = url.href;
          document.head.append(hint);
        });
      }).catch(() => {});
    prefetched.set(destination.href, request);
    return request;
  }
  function prepare(event) {
    const destination = destinationFor(event);
    if (destination && path(destination.pathname) !== path(location.pathname)) warm(destination);
  }
  document.addEventListener('pointerover', prepare, { passive: true });
  document.addEventListener('focusin', prepare);
  document.addEventListener('touchstart', prepare, { passive: true });
  let leaving = false;
  document.addEventListener('click', async event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = destinationFor(event);
    if (!destination) return;
    if (path(destination.pathname) === path(location.pathname) && destination.search === location.search) {
      if (!destination.hash || destination.hash === location.hash) {
        event.preventDefault();
        const target = destination.hash && document.getElementById(decodeURIComponent(destination.hash.slice(1)));
        if (target) {
          target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
          target.focus?.({ preventScroll: true });
        }
        else {
          if (!destination.hash && location.hash) history.pushState(null, '', destination.pathname + destination.search);
          window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
        }
      }
      return;
    }
    if (reduced.matches) return;
    try { sessionStorage.setItem('portfolio-navigation', JSON.stringify({ url: destination.href, at: Date.now() })); } catch {}
    if (nativeTransitions) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    await Promise.race([warm(destination), new Promise(resolve => setTimeout(resolve, 350))]);
    const page = document.getElementById('main');
    if (!page) { location.assign(destination.href); return; }
    // Keep the last faded frame until the next document replaces it.
    // Cancelling here would briefly show the outgoing page again.
    const exit = page.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 180, easing: 'cubic-bezier(.27,0,.51,1)', fill: 'forwards'
    });
    animations.add(exit);
    await exit.finished.catch(() => {});
    location.assign(destination.href);
  });
  window.addEventListener('pageshow', event => {
    leaving = false;
    if (!event.persisted) return;
    root.classList.remove('page-fallback-entering');
    animations.forEach(animation => animation.cancel());
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    root.classList.remove('page-motion-enabled', 'page-fallback-entering');
    observer.disconnect();
    animations.forEach(animation => animation.cancel());
  });
}
