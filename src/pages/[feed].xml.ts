import rss from '@astrojs/rss';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { FEED_DESCRIPTION, FEED_TITLE, feedItems, feedPaths } from '../lib/feed';

// `/rss.xml`, only once a non-draft post exists (see `feedPaths`).
export const getStaticPaths = (async () =>
  feedPaths(await getCollection('writing'))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be set in astro.config.mjs');
  return rss({
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    site,
    items: feedItems(await getCollection('writing')),
    trailingSlash: false,
    customData: '<language>en</language>',
  });
};
