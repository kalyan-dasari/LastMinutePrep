const revealItems = document.querySelectorAll('.reveal-on-scroll');

if (revealItems.length > 0 && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${Math.random() * 0.12}s`;
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

const clickableCards = document.querySelectorAll('.card-clickable[data-href]');

clickableCards.forEach((card) => {
  card.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('a, button, form, input, textarea, select, .no-card-nav')) return;

    const href = card.getAttribute('data-href');
    if (!href || href === '#') return;

    if (card.getAttribute('data-target-blank') === 'true') {
      window.open(href, '_blank', 'noopener');
      return;
    }

    window.location.href = href;
  });
});
