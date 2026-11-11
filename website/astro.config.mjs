// @ts-check
import { defineConfig } from 'astro/config';

// Set SITE_URL (e.g. https://connectmouse.example) when the final domain is known;
// it enables absolute canonical / Open Graph URLs and the sitemap link.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
});
