import type { APIRoute } from 'astro';
import { PERSON, buildMenu } from './menu';
import { getCourses, getPosts, getResearch } from './visibility';

/** Shared `GET` for `/menu.txt` and `/llms.txt`: same content, no redirect (#17). */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be set in astro.config.mjs');
  const [courses, research, posts] = await Promise.all([getCourses(), getResearch(), getPosts()]);
  const body = buildMenu({ site, person: PERSON, courses, research, posts });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
