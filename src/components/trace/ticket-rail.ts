/**
 * <ticket-rail>: the ticket rail and trace replay (#37). The markup is
 * server-rendered (TicketRail.astro); this only adds behaviour:
 *
 * - pressing a card sets `aria-pressed` and loads that project's latest run
 *   from the inline JSON, built from a <template> by textContent (no HTML
 *   strings, so Trusted Types has nothing to check);
 * - the replay reveals steps one by one on the compressed clock in each step's
 *   `delayMs`, once, when the panel first enters the viewport, and again on
 *   Replay;
 * - under reduced motion every step shows at once and Replay is hidden.
 *
 * State lives in the panel's `data-state` (static | armed | playing | done)
 * and each revealed step's `data-shown`; the CSS does the rest.
 */
import type { Replay, ReplayStep } from '../../lib/trace-view';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

type State = 'static' | 'armed' | 'playing' | 'done';

class TicketRail extends HTMLElement {
  #replays: Record<string, Replay> = {};
  #current: Replay | undefined;
  #panel: HTMLElement | null = null;
  #replayButton: HTMLButtonElement | null = null;
  #timer: number | undefined;
  #observer: IntersectionObserver | undefined;
  #motion = matchMedia(REDUCED_MOTION);
  #abort: AbortController | undefined;

  connectedCallback(): void {
    const data = this.querySelector('script[data-replays]');
    this.#panel = this.querySelector('.trace');
    this.#replayButton = this.querySelector('button[data-replay]');
    if (!data?.textContent || !this.#panel) return;
    this.#replays = JSON.parse(data.textContent) as Record<string, Replay>;
    const pressed = this.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    this.#current = this.#replays[pressed?.dataset['project'] ?? ''];

    this.#abort = new AbortController();
    const { signal } = this.#abort;
    for (const card of this.#cards()) {
      card.addEventListener('click', () => this.select(card.dataset['project'] ?? ''), { signal });
    }
    this.#replayButton?.addEventListener('click', () => this.play(), { signal });
    this.#motion.addEventListener('change', () => this.#onMotionChange(), { signal });

    if (this.#reduced()) return;
    if (this.#replayButton) this.#replayButton.hidden = false;
    this.#setState('armed');
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.#observer?.disconnect();
        this.play();
      },
      { threshold: 0.35 },
    );
    this.#observer.observe(this.#panel);
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#observer?.disconnect();
    window.clearTimeout(this.#timer);
  }

  /** Presses one project's card and loads its latest run. */
  select(project: string): void {
    const replay = this.#replays[project];
    if (!replay || !this.#panel) return;
    for (const card of this.#cards()) {
      card.setAttribute('aria-pressed', String(card.dataset['project'] === project));
    }
    this.#observer?.disconnect();
    if (replay !== this.#current) this.#render(replay);
    this.#current = replay;
    if (this.#reduced()) this.#showAll();
    else this.play();
  }

  /** Replays the current run from its first step. */
  play(): void {
    if (!this.#panel) return;
    if (this.#reduced()) return this.#showAll();
    window.clearTimeout(this.#timer);
    const steps = this.#steps();
    steps.forEach((s) => s.removeAttribute('data-shown'));
    this.#setState('playing');
    const delays = this.#current?.steps.map((s) => s.delayMs) ?? [];
    const reveal = (i: number) => {
      const step = steps[i];
      if (!step) return this.#setState('done');
      step.setAttribute('data-shown', '');
      if (i === steps.length - 1) return this.#setState('done');
      this.#timer = window.setTimeout(() => reveal(i + 1), delays[i + 1] ?? 800);
    };
    reveal(0);
  }

  #cards(): HTMLButtonElement[] {
    return [...this.querySelectorAll<HTMLButtonElement>('button[data-project]')];
  }

  #steps(): HTMLElement[] {
    return [...(this.#panel?.querySelectorAll<HTMLElement>('[data-step]') ?? [])];
  }

  #reduced(): boolean {
    return this.#motion.matches;
  }

  #setState(state: State): void {
    if (this.#panel) this.#panel.dataset['state'] = state;
  }

  #showAll(): void {
    window.clearTimeout(this.#timer);
    this.#steps().forEach((s) => s.setAttribute('data-shown', ''));
    this.#setState('static');
  }

  #onMotionChange(): void {
    if (this.#replayButton) this.#replayButton.hidden = this.#reduced();
    if (this.#reduced()) {
      this.#observer?.disconnect();
      this.#showAll();
    }
  }

  #render(replay: Replay): void {
    const panel = this.#panel!;
    panel.dataset['run'] = replay.runId;
    const title = panel.querySelector('[data-slot="title"]');
    const list = panel.querySelector('[data-slot="steps"]');
    const summary = panel.querySelector('[data-slot="summary"]');
    const template = this.querySelector<HTMLTemplateElement>('template[data-step-template]');
    if (!title || !list || !summary || !template) return;
    title.textContent = replay.title;
    list.replaceChildren(...replay.steps.map((s) => this.#stepElement(template, s)));
    summary.textContent = replay.summary.join(' · ');
  }

  #stepElement(template: HTMLTemplateElement, step: ReplayStep): Element {
    const li = template.content.firstElementChild!.cloneNode(true) as Element;
    const slot = (name: string) => li.querySelector<HTMLElement>(`[data-slot="${name}"]`);
    slot('stamp')!.textContent = step.stamp;
    slot('label')!.textContent = step.label;
    slot('text')!.textContent = step.text;
    const model = slot('model');
    if (step.model) model!.textContent = ` · ${step.model}`;
    else model?.remove();
    const verdict = slot('verdict');
    if (step.verdict) {
      verdict!.textContent = step.verdictLabel ?? step.verdict;
      verdict!.dataset['verdict'] = step.verdict;
    } else verdict?.remove();
    return li;
  }
}

if (!customElements.get('ticket-rail')) customElements.define('ticket-rail', TicketRail);
