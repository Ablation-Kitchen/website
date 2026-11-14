import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import {
  projectSchema,
  researchSchema,
  statusSchema,
  traceEntryId,
  traceSchema,
  workSchema,
  writingSchema,
} from './lib/schemas';

const work = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/work' }),
  schema: workSchema,
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: writingSchema,
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: researchSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/projects' }),
  schema: projectSchema,
});

/** One JSON file per run at `src/content/traces/<project>/<run-id>.json` (#10). */
const traces = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/traces',
    generateId: ({ entry, data }) => traceEntryId(entry, data),
  }),
  schema: traceSchema,
});

/** `src/data/status.json` as a single-entry collection with id `current`. */
const statusLoader: Loader = {
  name: 'status-json',
  load: async ({ config, store, parseData, watcher }) => {
    const statusFile = fileURLToPath(new URL('src/data/status.json', config.root));
    const sync = async () => {
      const raw = JSON.parse(await readFile(statusFile, 'utf8')) as Record<string, unknown>;
      const data = await parseData({ id: 'current', data: raw });
      store.clear();
      store.set({ id: 'current', data });
    };
    await sync();
    watcher?.add(statusFile);
    watcher?.on('change', (changed) => {
      if (changed === statusFile) void sync();
    });
  },
};

const status = defineCollection({ loader: statusLoader, schema: statusSchema });

export const collections = { work, writing, research, projects, traces, status };
