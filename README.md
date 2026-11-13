# ablation.kitchen

Dalmo Veras's personal site: case studies, research and writing on AI engineering. Live at https://ablation.kitchen.

Static Astro site deployed to Cloudflare Workers static assets. The vocabulary lives in [`GLOSSARY.md`](GLOSSARY.md).

## Local development

Requires Node 26 (`.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev     # http://localhost:4321
pnpm build   # static output in dist/
pnpm check   # astro check (strict TypeScript)
```

## License

Code: MIT ([`LICENSE`](LICENSE)). Content (case studies, writing, research, images, CV): all rights reserved ([`src/content/LICENSE`](src/content/LICENSE)).
