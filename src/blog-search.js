// Filter the server-rendered listing; keep the same cards, links and hover effects.
const listing = document.querySelector('.blog-index');
if (listing) {
  const search = listing.querySelector('.blog-search');
  const input = search.querySelector('input');
  const clear = search.querySelector('.blog-search-clear');
  const empty = listing.querySelector('.blog-search-empty');
  const results = listing.querySelector('#blog-results');
  const status = listing.querySelector('[data-search-status]');
  const normalize = value => value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
  const cards = [...listing.querySelectorAll('.blog-preview-card')].map(card => ({
    element: card,
    text: normalize([card.querySelector('h3')?.textContent, card.querySelector('.blog-card-excerpt')?.textContent].join(' ')),
  }));
  let announceTimer;
  function filter(announce = true) {
    const query = normalize(input.value);
    const terms = query ? query.split(/\s+/) : [];
    let count = 0;
    for (const card of cards) {
      const matches = terms.every(term => card.text.includes(term));
      card.element.hidden = !matches;
      if (matches) count++;
    }
    empty.hidden = count > 0;
    results.hidden = count === 0;
    clear.hidden = !input.value;
    clearTimeout(announceTimer);
    if (announce) announceTimer = setTimeout(() => {
      status.textContent = `${count} ${count === 1 ? 'article' : 'articles'} found.`;
    }, 200);
  }
  function reset() { input.value = ''; filter(); input.focus({ preventScroll: true }); }
  input.addEventListener('input', () => filter());
  input.addEventListener('search', () => filter());
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) { event.preventDefault(); reset(); }
  });
  clear.addEventListener('click', reset);
  // Browser-restored field values are filtered on back/forward navigation too.
  addEventListener('pageshow', () => filter(false));
  filter(false);
}
