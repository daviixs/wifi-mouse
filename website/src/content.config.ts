import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Blog posts live in src/content/blog/*.md. Frontmatter drives the listing card,
 * SEO tags, the landing "Setup Guides" card, the FAQ block and the JSON-LD.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(80),
      /** <title> tag; defaults to `title`. Keep under ~60 characters. */
      seoTitle: z.string().max(70).optional(),
      description: z.string().min(70).max(165),
      category: z.string(),
      tags: z.array(z.string()).min(1),
      keywords: z.array(z.string()).min(1),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      /** Lower numbers appear first on the landing page and in the listing. */
      order: z.number().int(),
      cover: image(),
      coverAlt: z.string(),
      /** CSS object-position used when the cover is cropped into cards. */
      coverFocus: z.string().default('50% 30%'),
      /** Short title used on the landing "Setup Guides" card. */
      cardTitle: z.string(),
      /** Which download the end-of-article CTA promotes. */
      cta: z.enum(['mac', 'windows', 'phone']),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).min(3),
    }),
});

export const collections = { blog };
