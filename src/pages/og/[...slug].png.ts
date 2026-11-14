/**
 * OG images (#39): one 1200×630 PNG per card at `/og/<slug>.png`, rendered at
 * build time with Satori + resvg. The cards come from `getOgCards()`, which
 * reads content through the visibility helpers, so drafts get no image.
 */
import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { ogSlug } from '../../lib/og/cards';
import { getOgCards } from '../../lib/og/pages';
import { renderCard } from '../../lib/og/render';

export const getStaticPaths = (async () =>
  (await getOgCards()).map((card) => ({
    params: { slug: ogSlug(card.path) },
    props: { card },
  }))) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = async ({ props }) =>
  new Response(await renderCard(props.card), { headers: { 'Content-Type': 'image/png' } });
