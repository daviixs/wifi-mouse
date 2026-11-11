/** Article enhancements: active TOC entry, reading progress and the dismissible sticky CTA. */
const prose = document.querySelector<HTMLElement>('[data-prose]');
const toc = document.querySelector<HTMLElement>('[data-toc]');

/* Highlight the section currently being read in the "In this article" list. */
if (prose && toc && 'IntersectionObserver' in window) {
  const links = new Map<string, HTMLAnchorElement>();
  toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => links.set(decodeURIComponent(a.hash.slice(1)), a));
  const targets = [...links.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  const setActive = (id: string) =>
    links.forEach((a, key) => {
      const active = key === id;
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  const io = new IntersectionObserver(
    () => {
      // The active section is the last heading that has scrolled past the top third of the viewport.
      const line = window.innerHeight * 0.33;
      let current = targets[0]?.id ?? '';
      for (const el of targets) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    },
    { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] },
  );
  targets.forEach((el) => io.observe(el));
}

/* Sticky CTA + reading progress */
const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
const progress = document.querySelector<HTMLElement>('[data-reading-progress]');
const DISMISS_KEY = 'connectmouse:sticky-cta-dismissed';
let dismissed = false;
try {
  dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
} catch {
  /* storage unavailable: the bar can still be dismissed for this page view */
}

if (bar && prose && !dismissed) {
  const update = () => {
    const rect = prose.getBoundingClientRect();
    const total = rect.height - window.innerHeight * 0.5;
    const read = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - rect.top) / Math.max(1, total)));
    if (progress) progress.style.transform = `scaleX(${read})`;
    const show = read > 0.12 && rect.bottom > window.innerHeight * 0.4;
    bar.hidden = false;
    bar.classList.toggle('is-visible', show);
    bar.toggleAttribute('inert', !show);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  bar.querySelector('[data-sticky-close]')?.addEventListener('click', () => {
    bar.remove();
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  });
}
