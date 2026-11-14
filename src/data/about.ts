/**
 * About page copy (spec: Content → About; Positioning → keyword line).
 * Kept apart from the page so the homepage's Kitchen rules section (#33) can
 * read the same rules. Public repo: public facts only.
 */

/** Hero keyword line, shared with the homepage (spec: Positioning). */
export const keywordLine =
  'Lead AI Engineer · AI agents, retrieval systems, applied ML in production';

/** The story paragraph, then the PhD paragraph. */
export const story = [
  'Ten years building software across Brazil, Cyprus and Canada: founding engineer, company founder, applied-AI engineer at Fortinet, and now leading the AI team at iCounter. I like the moment a research idea survives contact with production.',
  "In parallel, I'm doing a PhD at the University of Warwick on topology-aware machine learning, applied to threat detection in critical infrastructure.",
] as const;

export interface Education {
  degree: string;
  school: string;
  years: string;
}

/** Newest first. */
export const education: readonly Education[] = [
  {
    degree: 'PhD, Computer Science',
    school: 'University of Warwick',
    years: '2026–2028 (expected)',
  },
  { degree: 'MSc, Cybersecurity', school: 'New York Institute of Technology', years: '2024' },
  { degree: 'BSc, Information Systems', school: 'UNISINOS, Brazil', years: '2020' },
];

export interface KitchenRule {
  /** Two-digit label, `01`…`05`. */
  n: string;
  rule: string;
  /** The plain meaning under the rule. */
  meaning: string;
}

/** The five kitchen rules (GLOSSARY: Kitchen rule). */
export const kitchenRules: readonly KitchenRule[] = [
  { n: '01', rule: 'Nothing leaves the pass untasted.', meaning: 'Every change has an eval.' },
  { n: '02', rule: 'Mise en place before fire.', meaning: 'Design the context before the prompt.' },
  { n: '03', rule: 'One station, one job.', meaning: 'Narrow agents beat general ones.' },
  { n: '04', rule: 'Clean as you go.', meaning: 'Observability is not a later task.' },
  { n: '05', rule: 'The chef cooks too.', meaning: 'Principals still write code.' },
];
