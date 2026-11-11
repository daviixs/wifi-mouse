/** Progressive enhancement for the landing page. Everything works without JS. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Sticky header state */
const header = document.querySelector<HTMLElement>('[data-header]');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* Mobile menu */
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
const setMenu = (open: boolean) => {
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.sr-only')!.textContent = open ? 'Close menu' : 'Open menu';
  menu.hidden = !open;
};
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
menu?.querySelectorAll('[data-menu-link]').forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});
window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => e.matches && setMenu(false));

/* Count-up numbers */
const countUp = (el: HTMLElement) => {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target) || reduceMotion) return;
  const duration = 1400;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
};

/* Scroll reveal */
const revealTargets = document.querySelectorAll<HTMLElement>('.reveal, .animated-text, [data-count]');
if (!('IntersectionObserver' in window) || reduceMotion) {
  revealTargets.forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add('is-visible');
        if (el.dataset.count) countUp(el);
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  revealTargets.forEach((el) => io.observe(el));
}

/* Magnetic primary buttons */
if (finePointer && !reduceMotion) {
  document.querySelectorAll<HTMLElement>('.is-magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (event) => {
      const r = btn.getBoundingClientRect();
      const x = (event.clientX - r.left - r.width / 2) * 0.25;
      const y = (event.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
  });
}

/* Pricing platform toggle (macOS / Windows) */
const plan = document.querySelector<HTMLElement>('[data-plan]');
const tabs = document.querySelectorAll<HTMLButtonElement>('[data-platform]');
const selectPlatform = (platform: string) => {
  tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.platform === platform)));
  if (!plan) return;
  plan.classList.toggle('show-windows', platform === 'windows');
  plan.classList.remove('plan-swap');
  void plan.offsetWidth;
  plan.classList.add('plan-swap');
};
tabs.forEach((tab) => tab.addEventListener('click', () => selectPlatform(tab.dataset.platform ?? 'mac')));
tabs.forEach((tab, i) =>
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    selectPlatform(next.dataset.platform ?? 'mac');
  }),
);
document.querySelectorAll<HTMLAnchorElement>('a[href="#pricing"]').forEach((link) => {
  if (link.textContent?.includes('Windows')) link.addEventListener('click', () => selectPlatform('windows'));
});
if (/windows/i.test(navigator.userAgent)) selectPlatform('windows');

/* Steps carousel: buttons, drag, autoplay (paused on hover/focus/reduced motion) */
document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((root) => {
  const track = root.querySelector<HTMLElement>('[data-carousel-track]')!;
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
  const step = () => (slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth);
  const current = () => Math.round(track.scrollLeft / step());
  const markCurrent = () => slides.forEach((s, i) => s.classList.toggle('is-current', i === current()));
  const go = (dir: 1 | -1) => {
    const max = track.scrollWidth - track.clientWidth - 2;
    const atEnd = track.scrollLeft >= max;
    const left = dir === 1 && atEnd ? 0 : track.scrollLeft + dir * step();
    track.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  root.querySelector('[data-carousel-next]')?.addEventListener('click', () => go(1));
  root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => go(-1));
  track.addEventListener('scroll', markCurrent, { passive: true });
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
  });
  markCurrent();

  let dragX = 0;
  let dragLeft = 0;
  let dragging = false;
  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    dragging = true;
    dragX = event.clientX;
    dragLeft = track.scrollLeft;
    track.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (event) => {
    if (dragging) track.scrollLeft = dragLeft - (event.clientX - dragX);
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    const index = Math.round(track.scrollLeft / step());
    track.scrollTo({ left: index * step(), behavior: 'smooth' });
  });

  if (reduceMotion) return;
  let paused = false;
  let visible = false;
  root.addEventListener('pointerenter', () => (paused = true));
  root.addEventListener('pointerleave', () => (paused = false));
  root.addEventListener('focusin', () => (paused = true));
  root.addEventListener('focusout', () => (paused = false));
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(root);
  window.setInterval(() => {
    if (!paused && visible && !document.hidden) go(1);
  }, 4500);
});
