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

Optional: `SITE_URL=https://your-domain npm run build` adds absolute canonical / Open Graph URLs.

## Structure

- `src/pages/index.astro` — page composition (one component per section).
- `src/components/` — sections plus reusable pieces (`PhoneMockup`, `Screen`, `Heading`, `Button`, `Icon`).
- `src/config/site.ts` — **every outbound link** (downloads, GitHub, docs). Edit here only.
- `src/assets/screens/` — real app screenshots (Expo web build, 390×844 viewport), optimized to AVIF/WebP
  in several widths at build time by `astro:assets`.
- `src/scripts/main.ts` — progressive enhancement: sticky header, mobile menu, scroll reveal, count-up,
  magnetic buttons, pricing toggle and carousel. Honors `prefers-reduced-motion`.

## Links that still need real URLs

The project has no published store listings or release binaries yet, so `downloads.phone`,
`downloads.mac` and `downloads.windows` in `src/config/site.ts` point to the GitHub Releases page.
Replace them with the Play Store / App Store / Microsoft Store / direct download URLs when available.

## Credits

Fonts: Figtree and Instrument Serif (SIL Open Font License, via Fontsource). Icons: Lucide (ISC).
Layout inspired by a public landing page reference; all code, copy and graphics here are original.
