/**
 * Site paths, in one place so pages, `/menu.txt`, RSS and the OG endpoint
 * agree. Paths have no trailing slash (`trailingSlash: 'never'`).
 */

/** The tasting menu: every case study (#32 builds the route). */
export const WORK_PATH = '/work';

/** A case study (course) page: `/work/<id>`. */
export const coursePath = (id: string) => `/work/${id}`;

/** The recipe book: every post (#44). Built only once a non-draft post exists (#6). */
export const WRITING_PATH = '/writing';

/** A post page: `/writing/<id>` (#44). */
export const postPath = (id: string) => `${WRITING_PATH}/${id}`;

export const RESEARCH_PATH = '/research';
export const ABOUT_PATH = '/about';
export const CV_PATH = '/cv.pdf';

/** Absolute URL for a site path, e.g. `absoluteUrl('/about', site)` → `https://ablation.kitchen/about`. */
export function absoluteUrl(path: string, site: URL | string): string {
  return new URL(path, site).href;
}
