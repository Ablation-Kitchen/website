import { describe, expect, it } from 'vitest';
import { dishesHref, featuredPosts, homepageSections } from '../src/lib/homepage';

const empty = { rail: [], courses: [], posts: [] };

describe('homepageSections', () => {
  it('with no traces and no posts, goes hero → tasting menu → Lab → Kitchen rules', () => {
    expect(homepageSections({ ...empty, courses: [{}, {}, {}, {}] })).toEqual([
      'hero',
      'tasting-menu',
      'lab',
      'kitchen-rules',
    ]);
  });

  it('shows every section, in spec order, once there is content for each', () => {
    expect(homepageSections({ rail: [{}], courses: [{}], posts: [{}] })).toEqual([
      'hero',
      'whats-cooking',
      'tasting-menu',
      'recipe-book',
      'lab',
      'kitchen-rules',
    ]);
  });

  it('shows What’s cooking only once a project has a trace', () => {
    expect(homepageSections(empty)).not.toContain('whats-cooking');
    expect(homepageSections({ ...empty, rail: [{}] })).toContain('whats-cooking');
  });

  it('shows the recipe book once a post exists, and only then (#44)', () => {
    expect(homepageSections(empty)).not.toContain('recipe-book');
    expect(homepageSections({ ...empty, posts: [{}] })).toContain('recipe-book');
  });

  it('never renders an empty tasting menu', () => {
    expect(homepageSections(empty)).toEqual(['hero', 'lab', 'kitchen-rules']);
  });
});

describe('featuredPosts', () => {
  it('takes the first two (the newest)', () => {
    expect(featuredPosts(['c', 'b', 'a'])).toEqual(['c', 'b']);
    expect(featuredPosts(['a'])).toEqual(['a']);
    expect(featuredPosts([])).toEqual([]);
  });
});

describe('dishesHref', () => {
  it('scrolls to the tasting menu when it is on the page', () => {
    expect(dishesHref(['hero', 'tasting-menu'])).toBe('#tasting-menu');
  });
  it('falls back to /work otherwise', () => {
    expect(dishesHref(['hero', 'lab'])).toBe('/work');
  });
});
