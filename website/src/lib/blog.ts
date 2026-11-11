import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Trailing slashes match the static output (dist/blog/<slug>/index.html), canonical URLs and the sitemap. */
export const BLOG_PATH = '/blog/';

/** Posts ordered for the landing cards and the listing (by `order`, then newest first). */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog');
  return posts.sort(
    (a, b) => a.data.order - b.data.order || b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export const postPath = (post: Post | string) => `${BLOG_PATH}${typeof post === 'string' ? post : post.id}/`;

/** Reading time at ~220 words per minute, ignoring code fences, HTML tags and Markdown syntax. */
export function readingMinutes(markdown = ''): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_|`-]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
export const formatDate = (date: Date) => dateFormat.format(date);
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Absolute URL when `site` is configured, otherwise a root-relative path. */
export const absolute = (path: string, site: URL | undefined) => (site ? new URL(path, site).href : path);
