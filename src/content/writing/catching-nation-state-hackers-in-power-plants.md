---
title: "Catching Nation-State Hackers in Power Plants: What the Research Gets Right (and Wrong)"
date: 2026-11-12
tags: [ics-security, ot, apt, research, scada, threat-detection]
description: "A casual tour through my literature review on detecting Advanced Persistent Threats in industrial systems, and why the sneakiest attacks still slip through."
---

# Catching Nation-State Hackers in Power Plants: What the Research Gets Right (and Wrong)

> **TL;DR:** We've gotten pretty good at noticing when something physically weird happens inside a plant. We're still bad at catching the patient, quiet attackers who use a plant's own tools against it. And most of the field tests its ideas on the same couple of datasets from one water-treatment testbed. Not great.

I recently finished a systematic literature review on detecting **Advanced Persistent Threats (APTs)** in **Operational Technology and Industrial Control Systems (OT/ICS)**. The full paper is dense, so here's the friendly version.

Grab a coffee. Let's go.

---

## What are we talking about?

**OT/ICS** is the tech that runs the physical world: power grids, water plants, factories, pipelines, trains. Small computers called **PLCs** open valves and run pumps. **SCADA** systems let operators watch and control all of it from a control room. Everything talks over industrial protocols like Modbus and DNP3.

**APTs** aren't your average ransomware crew. They're well-funded attackers, often backed by a nation state, who pick a target and take their time. They:

- **Stick around for a long time**, sometimes months or years.
- **Move quietly**, nothing flashy.
- **Work in stages**: scout the place, get a foothold, spread out, make sure they can come back, and only *then* do the real damage.

This isn't hypothetical. Stuxnet wrecked uranium centrifuges, attacks on Ukraine's grid caused blackouts, and TRITON went after a plant's safety systems.

## Why is it so hard?

Defending a plant is a different game from defending an office network.

**You can't poke anything.** Monitoring has to be passive. Actively scanning a controller can disrupt the process or trigger a safety shutdown.

**False alarms are costly.** In IT, a false alarm means an annoyed analyst. In a plant, it can mean an unnecessary shutdown, and eventually operators who stop trusting the alerts.

**The attackers follow the rules.** Sort of. They send commands that are perfectly valid but harmful in context. They nudge values while keeping them inside normal ranges. They use the plant's own engineering software instead of malware. Or they tamper with vendor updates before those updates ever reach the plant.

Think of it like a kitchen. A bad cook who sets the stove on fire is easy to spot. The real problem is the one who quietly adds a little too much salt to every dish for three months, using your own salt shaker. Every single action looks normal. The damage only shows up over time.

---

## How I did it

I followed **PRISMA**, the standard recipe for doing a systematic review properly. In short: I cast a wide net across research databases, cleared out the duplicates, skimmed abstracts to drop anything off-topic, then read the survivors in full. Only papers that were genuinely about multi-stage attacks on industrial systems, and that tested their ideas on industrial data, made the final cut.

The survivors span from 2010 to 2026, and I tagged each one on what method it uses, which attacker behaviors it targets, what data it watches, and how it was tested.

---

## The field is growing fast

More than half of the research came out in just the last few years. That lines up with high-profile attacks on infrastructure and with MITRE publishing ATT&CK for ICS, a public catalog of how attackers go after industrial systems.

Energy gets the most attention, with nearly half of all papers. Water and manufacturing follow. Oil and gas and transportation barely show up at all, which is strange given how attractive those targets are.

Most of this work is also purely academic. Around three-quarters of papers had no industry partner, so it's hard to say how much of it ever reaches a real plant.

---

## The main approaches

Researchers come at this problem from a lot of angles. Here are the big ones, roughly from most to least popular:

- **Machine learning** is the most common by far. It learns complex patterns but needs lots of labeled data, struggles to explain itself, and can be fooled.
- **Hybrid designs** mix several approaches. These look the most promising overall, though stitching them together is real work.
- **Physics-aware detection** uses knowledge of the actual process. If a sensor says a tank filled faster than its pipe physically allows, something's off. Great at spotting stealthy tampering, but it needs an accurate model of the plant.
- **Attack-graph and provenance methods** try to rebuild the whole story of an attack. Powerful, but heavy and hungry for logs.
- **Protocol inspection** reads industrial traffic closely. Can't catch valid-but-evil commands.
- **Signatures and rules** are cheap and clear, but useless against anything new.
- **Honeypots** are decoys. Very reliable when they fire, but only if the attacker takes the bait.

No single approach does the job alone. A good kitchen has a thermometer, a timer, *and* someone tasting the food. Detection works the same way: you need layers.

---

## Everyone talks about multi-stage attacks. Few connect the dots.

This was the finding that stuck with me most.

Close to two-thirds of papers *mention* multi-stage attacks. Less than a quarter actually *link the stages together*.

The rest look at one event at a time. And that's a problem, because each step of an APT looks harmless on its own. A single-event detector can't tell scouting from routine network management, or an attacker moving between machines from an admin doing their job.

It's like finding a few crumbs on the counter, an open fridge, and a missing slice of cake, and treating each one as a separate mystery. The story only makes sense when you put the clues together.

The good news is that the papers that *do* connect the dots are some of the most interesting work in the field.

---

## The sneakiest tactics get the least attention

The attacker behaviors that are hardest to catch are exactly the ones researchers study least:

- **Living off the land**, using the plant's own legitimate engineering tools, shows up in only about 4% of papers. Stuxnet, TRITON and PIPEDREAM all leaned on it.
- **Supply-chain tampering**, hiding malicious code in vendor updates or project files, sits around 5%.
- **Long dwell time** gets a bit more attention, but even then, testing usually squeezes months of attacker activity into hours or days.

## Detection kicks in too late

Most methods are good at catching the *end* of an attack, when the process is already being disrupted. They're much weaker at the early stages, like scouting and getting a first foothold, which is exactly when catching an attacker would stop the whole thing.

Smelling smoke is useful. Noticing someone fiddling with the gas line an hour earlier is better.

---

## The testing problem

This one's a little awkward for the field.

A large share of research tests on the same two datasets, both from a single small water-treatment testbed. Most papers test against generic, noisy attacks, and only around 14% try anything that resembles a real APT. Very few use data from actual plants.

So those impressive detection scores often don't mean much. They're measured against attacks that are easy to spot, on clean data without the everyday messiness of a real plant. Doing well on one small water testbed says little about a power station or a pipeline.

---

## Would anyone actually deploy this?

Some real-world needs get almost no attention:

- **Explainability.** Operators aren't security analysts. An alert that says "APT probability 0.87" gives them nothing to act on. Should they shut down? Isolate a section? Keep going? In a plant, a clear explanation is a safety requirement, not a nice extra.
- **Plants change.** New products, new settings, new equipment, seasonal demand. A detector that learned what "normal" looks like slowly goes stale, and very few methods deal with that.
- **Industry standards.** Real plants are designed and audited against frameworks like IEC 62443 and NIST SP 800-82. Only around 10% of papers connect their work to them.

## Nobody tests against attackers who fight back

Almost every method gets tested against a fixed, scripted attack. But a real APT has months to watch your detector, learn what it considers normal, and stay just inside that line. Treating the attacker as someone who doesn't adapt isn't a simplification. It's just wrong.

---

## What I think we should work on

1. **Connect the dots.** Build systems that link weak signals across the network, the computers, and the physical process into one coherent story.
2. **Go after the sneaky stuff.** Living off the land, supply-chain tampering, and small manipulations that add up over time.
3. **Better test data.** Realistic, public datasets from different industries, modeled on real campaigns, with attacks that last days instead of minutes.
4. **Build for the control room.** Clear explanations, detectors that keep up as the plant changes, and alignment with industry standards.
5. **Test against smart attackers.** If you say a method is ready for real use, show it holds up against someone who knows how it works.

## If you work in a plant

- Don't rely on one tool. Layer them.
- Watch the physical process, not just the network.
- Connect related alerts so you can tell a campaign from a blip.
- Value clear alerts and low false alarms as much as raw detection scores.

---

## Limitations

A few honest caveats. I only looked at English-language papers up to October 2026. The screening was strict, so some partially relevant work probably got left out. Some of the data extraction was AI-assisted with spot checks by hand. And published research tends to favor positive results, so the real picture may be a bit rosier on paper than in practice.

---

## Wrapping up

The field is moving fast, and there's real progress. Physics-aware detection, smarter machine learning and layered designs are all pushing things forward.

But there's still a big gap between what APTs actually do and what our detectors can catch. The stealthiest moves barely get studied, testing is too easy, and the things operators really need are mostly an afterthought.

The systems on the other end of these attacks keep the lights on and the water clean. Closing this gap matters.

If you're working on any of this, especially living-off-the-land detection, realistic datasets, or alerts that operators can actually use, I'd love to hear from you.

---

### Further reading

A few standout papers from the review:

- **RAPTOR:** APT detection in industrial IoT via attack stage correlation (2023). [doi:10.48550/arxiv.2301.11524](https://doi.org/10.48550/arxiv.2301.11524)
- **LOTL-hunter:** Detecting multi-stage living-off-the-land attacks using digital twins (Lo et al., 2026). [doi:10.1016/j.future.2026.108382](https://doi.org/10.1016/j.future.2026.108382)
- **E-APTDetect:** Early APT detection in critical infrastructure (Genge et al., 2023). [doi:10.3390/app13063409](https://doi.org/10.3390/app13063409)
- **Tracking APTs in industrial ecosystems** (Rubio et al., 2019). [doi:10.3233/JCS-191293](https://doi.org/10.3233/JCS-191293)
- **Two-stage APT attack on an IEC 61850 power grid substation** (Akbarzadeh et al., 2024). [doi:10.1007/s10207-024-00856-6](https://doi.org/10.1007/s10207-024-00856-6)

*The full paper is available on request.*
