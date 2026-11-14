/**
 * Every OG card the build renders, read through the visibility helpers (#6),
 * so a draft course or post gets no card, even in a `PREVIEW_DRAFTS=1` build.
 * The endpoint (`src/pages/og/[...slug].png.ts`) and BaseLayout both use this
 * list, so a page has a card exactly when its PNG is built.
 */
import { getCourses, getPosts } from '../visibility';
import {
  STATIC_CARDS,
  cardFor,
  checkCards,
  courseCard,
  ogImageAlt,
  ogImagePath,
  postCard,
  type OgCard,
} from './cards';

export async function getOgCards(): Promise<readonly OgCard[]> {
  const [courses, posts] = await Promise.all([getCourses(), getPosts()]);
  return checkCards([...STATIC_CARDS, ...courses.map(courseCard), ...posts.map(postCard)]);
}

/** BaseLayout's `og:image` for a page: its own card, or the home card. */
export async function ogImageFor(pathname: string) {
  const card = cardFor(pathname, await getOgCards());
  return { src: ogImagePath(card), alt: ogImageAlt(card) };
}
