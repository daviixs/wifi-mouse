# ConnectMouse — landing page

Static marketing site for ConnectMouse, built with [Astro](https://astro.build). It is fully
self-contained: its own `package.json`, no changes to the Expo app or the desktop agents.

```sh
cd website
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks (astro check) and writes the static site to dist/
npm run preview  # serves dist/
```

Optional: `SITE_URL=https://your-domain npm run build` adds absolute canonical / Open Graph URLs, generates
`sitemap-index.xml` (via `@astrojs/sitemap`) and adds its `Sitemap:` line to `robots.txt`. Without `SITE_URL`
no sitemap is written, because sitemaps require absolute URLs.

## Writing a blog post

Add `src/content/blog/<keyword-slug>.md` with the frontmatter fields from `src/content.config.ts`
(`description` must be 70–165 characters, `faq` needs at least 3 entries). Use `##` question-style headings
(they become the table of contents), link to other posts with `/blog/<slug>/`, and reference screenshots
from `src/assets/screens/` with relative paths so `astro:assets` optimizes them. Callouts are plain HTML:
`<div class="callout callout-info">…</div>` or `callout-warning`. `npm run build` validates the frontmatter.

## Structure

- `src/pages/index.astro` — page composition (one component per section).
- `src/pages/privacy.astro` — Privacy Policy at `/privacy/`, linked from the footer (the Microsoft Store listing URL).
- `src/components/` — sections plus reusable pieces (`PhoneMockup`, `Screen`, `Heading`, `Button`, `Icon`).
- `src/config/site.ts` — **every outbound link** (downloads, GitHub, docs). Edit here only.
- `src/assets/screens/` — real app screenshots (Expo web build, 390×844 viewport), optimized to AVIF/WebP
  in several widths at build time by `astro:assets`.
- `src/content/blog/*.md` — blog posts (Markdown content collection, schema in `src/content.config.ts`).
  Frontmatter drives the listing card, SEO tags, the landing "Setup Guides" cards (`order`, `cardTitle`,
  `cover`), the FAQ block and the JSON-LD (BlogPosting, FAQPage, BreadcrumbList).
- `src/pages/blog/` — `/blog/` listing and `/blog/<slug>/` article pages; `src/components/blog/` and
  `src/styles/blog.css` hold their pieces (breadcrumbs, TOC, FAQ, CTA blocks, related posts).
- `src/scripts/main.ts` — progressive enhancement: sticky header, mobile menu, scroll reveal, count-up,
  magnetic buttons, pricing toggle and carousel. Honors `prefers-reduced-motion`.

## Links that still need real URLs

`downloads.windows` points to the Microsoft Store listing (https://apps.microsoft.com/detail/9MZHLB2RMLX8,
submitted for certification). The phone and Mac apps have no store listings or release binaries yet, so
`downloads.phone` and `downloads.mac` in `src/config/site.ts` point to the GitHub Releases page. Replace them
with the Play Store / App Store / direct download URLs when available.

## Credits

Fonts: Figtree and Instrument Serif (SIL Open Font License, via Fontsource). Icons: Lucide (ISC).
Layout inspired by a public landing page reference; all code, copy and graphics here are original.
