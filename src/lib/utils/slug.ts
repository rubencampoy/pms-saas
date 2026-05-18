/**
 * Convert an arbitrary string into a URL-safe slug.
 * Lowercase, ASCII, hyphens, no leading/trailing/double hyphens, max 80 chars.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
