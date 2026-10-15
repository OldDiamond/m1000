// Reference motion: a 200 ms page crossfade and word-by-word blur springs.
export function setupPageMotion() {
  window.__pageMotionReady = true;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeTransitions = 'onpagereveal' in window && 'onpageswap' in window;
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
      if (entry.isIntersecting) { reveal(entry.target); observer.unobserve(entry.target); }
    });
  }, { threshold: 0 });
  if (reduced.matches) root.classList.remove('page-motion-enabled');
  else headings.forEach(heading => observer.observe(heading));

  function enter() {
    if (!nativeTransitions && !reduced.matches && !root.classList.contains('opening-dots-active')) {
      track(root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.27,0,.51,1)' }));
    }
  }
  enter();
  let leaving = false;
  document.addEventListener('click', async event => {
    if (nativeTransitions || reduced.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || !/^https?:$/.test(destination.protocol) ||
      (destination.pathname === location.pathname && destination.search === location.search)) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    const exit = track(root.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 200, delay: 200, easing: 'cubic-bezier(.27,0,.51,1)', fill: 'forwards'
    }));
    await exit.finished.catch(() => {});
    location.assign(destination.href);
  });
  window.addEventListener('pageshow', event => {
    leaving = false;
    if (!event.persisted) return;
    animations.forEach(animation => animation.cancel());
    headings.forEach(heading => {
      const rect = heading.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < innerHeight) {
        heading.removeAttribute('data-reveal-played');
        reveal(heading);
      }
    });
    enter();
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    root.classList.remove('page-motion-enabled');
    observer.disconnect();
    animations.forEach(animation => animation.cancel());
  });
}
