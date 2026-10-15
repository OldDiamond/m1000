// Keep the reference GIF's original frames and timing; freeze it for reduced motion.
export function setupFooterMark() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.footer-mark').forEach(mark => {
    const image = mark.querySelector('img');
    const canvas = mark.querySelector('canvas');
    async function update() {
      if (!reduce.matches) {
        image.hidden = false;
        canvas.hidden = true;
        return;
      }
      try { await image.decode(); } catch { return; }
      if (!reduce.matches) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.hidden = false;
      image.hidden = true;
    }
    reduce.addEventListener('change', update);
    update();
  });
}
