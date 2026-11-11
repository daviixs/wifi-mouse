// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Set SITE_URL (e.g. https://connectmouse.example) when the final domain is known;
// it enables absolute canonical / Open Graph URLs, the sitemap and its robots.txt entry.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  // The site uses no tsconfig path aliases. Without this, Vite's resolver can walk up to the
  // Expo app's tsconfig.json in the repository root (which extends `expo/tsconfig.base`)
  // and fail when the root npm dependencies are not installed.
  vite: { resolve: { tsconfigPaths: false }, tsconfig: './tsconfig.json' },
  // The sitemap needs absolute URLs, so it is only generated when SITE_URL is set.
  integrations: site ? [sitemap()] : [],
});
