# ablation.kitchen

Dalmo Veras Neto's personal site. It presents AI engineering work through a light kitchen metaphor. Kitchen words name sections and content types; navigation and body copy stay plain English.

## Site content

**Case study**:
A long-form account of one piece of past or ongoing work, written in the seven-section kitchen flow (The order … What I'd cook differently).
_Avoid_: Dish, project, work item (“dish” is display copy only, e.g. “See the dishes →”)

**Tasting menu**:
The ordered list of all case studies, shown on `/work` and on the homepage.
_Avoid_: Portfolio, work list

**Course**:
A case study's position in the tasting menu, written as a lower-case roman numeral (i., ii., …).
_Avoid_: Index, number, rank

**Project**:
A piece of current work shown on the homepage ticket rail, identified by a three-digit ticket number (001, 002, …).
_Avoid_: Ticket (“Ticket 001” is display copy only), current project item

**Order**:
The first section of a case study: the problem, context, constraints and scope. Never a sort key or a description.
_Avoid_: Using “order” for sorting or summaries

**Post**:
A piece of writing in the recipe book: an essay, a design doc or a playbook.
_Avoid_: Recipe, article, blog entry (“recipe” is display copy only)

**Recipe book**:
The collection of all posts, shown on `/writing`.
_Avoid_: Blog

**Kitchen rule**:
One of the five numbered engineering principles on the About page.
_Avoid_: Principle, value, tenet

**Ablation Lab**:
The research section: studies, preprints, the PhD, talks and open-source releases.
_Avoid_: Research page, lab page

**Service**:
Production, in the metaphor's sense. It never names a colour theme; the themes are just Light and Dark.
_Avoid_: Using “service”/“prep” for dark/light mode

**Status strip**:
The single footer line saying what's cooking, what shipped last and what's being read.
_Avoid_: Footer status, ticker

## The metaphor (agent systems)

**Brigade**:
A multi-agent system arranged as a kitchen: one sous chef, several stations and the pass. Also the name of Dalmo's open-source project, _The Brigade_.
_Avoid_: Swarm, crew, team of agents

**Sous chef**:
The orchestrator or planner agent that splits incoming work across stations.
_Avoid_: Orchestrator (fine in body copy, but not as a role name in traces), manager agent

**Station**:
A specialist agent with a single job, such as retrieval, coding, tool use or critique.
_Avoid_: Worker, sub-agent, chef de partie

**The pass**:
The gate of evals, guardrails and human review that output must clear before it ships. As a page heading, “The Pass” also titles the homepage.
_Avoid_: Eval gate, QA step

**Mise en place**:
Context, prompts, tools and memory prepared before a run.
_Avoid_: Setup, prep

## Traces

**Task**:
The request a run works on: what came in at the start of the run.
_Avoid_: Ticket (the label “ticket” on a trace's first step is display copy only), job, prompt

**Run**:
One recorded execution of a brigade against one task.
_Avoid_: Session, job, execution

**Trace**:
The committed record of a run: its steps in order, plus its eval result.
_Avoid_: Log, transcript

**Step**:
One timestamped entry in a trace, attributed to a single role.
_Avoid_: Event, line, entry

**Role**:
The brigade member a step is attributed to (sous chef, a station, or the pass).
_Avoid_: Agent name, actor, who
