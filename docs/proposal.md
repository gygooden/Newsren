# My Newsren: project proposal

## Problem and research questions

I built My Newsren, a personal news research agent. The risk I wanted to design against is an assistant that writes plausible news-like text with no clear source. My working position is that an AI system in news should send readers to human reporting and primary documents, not replace them.

My research questions:

1. Can an agent with a fixed goal, a small tool set and hard limits produce briefings in which every displayed claim is tied to an exact quote?
2. Does showing coverage gaps and items outside a reader's topics help readers find things they would not have searched for?
3. Do readers understand a topic better, and transfer that understanding to new cases, after a grounded briefing than after an ordinary summary?
4. What does human review cost per briefing, and is that cost sustainable?

## Design decisions and alternatives

**Agent, not a summary call.** Calling a model to write a summary is not agentic. I gave the agent a goal, five tools, a loop it controls, and limits it cannot override. The alternative, a single prompt with pasted articles, would be cheaper but cannot decide what to look for.

**Verification in code, not in the prompt.** The prompt asks for exact quotes, but `verify.ts` decides what is shown. I considered asking a second model to check the first; I rejected that because it adds cost and still leaves a model as the judge. Deterministic matching is simpler to audit.

**The bottleneck.** The live agent costs money on every run and runs on a public site. I added origin checks, per-visitor and global daily limits, and per-run caps on steps, tool calls, tokens and time. The alternative, an open endpoint, would expose the owner to unbounded cost. A saved briefing built without a model is always available, so a limit never leaves the reader with an empty page.

**Human first.** Live briefings are private to the reader and labeled as not editor-reviewed. Publishing to the front page requires approval. I considered automatic publishing of high-confidence briefings and rejected it; a person should decide what is published.

**Sample local data.** I could not find a free, key-free source of local reporting. Rather than scrape outlets, I wrote fictional sample records with clearly marked fictional outlets and connected them to real federal and research documents only through shared topic tags.

## Two original features

**Coverage Gap Detector.** It flags primary documents, such as a WARN notice or a school board agenda item, that have no matching news coverage in the sources checked. It labels them "Not yet reported by a journalist" and drafts a tip for a partner newsroom. It never writes the story.

**Beyond your watch.** Each briefing adds one or two items outside the reader's topics, chosen by a transparent score (local impact, independent sources, document type) and shown with the reason. It does not use engagement data.

## Curiosity, creativity and collaboration

- Curiosity: the Ground Level lens asks what a national rule or trend means for one county, and the "Next questions to investigate" list links each question to the source that raised it.
- Creativity: the two original features treat gaps in coverage as information rather than as missing data.
- Collaboration: I plan to ask a local newsroom and classmates to review the coverage-gap tips and the briefing format. The list of sources, with licenses and rate limits, is in `config/sources.json` so others can reuse or extend it.

## Positioning across the four sections

- Technology: the Research Paper Decoder shows what an arXiv abstract does and does not state, and labels every preprint as not peer reviewed.
- Education: the Policy Impact Explorer turns Federal Register documents into who is affected and key dates, and the Evidence Checker separates faster completion from transfer to new problems.
- Industry: the Industry Impact view separates supported claims from hypotheses.
- Finance: Regulation Watch tracks SEC and banking agency documents, and the reality check labels claims as announcement, pilot, backtest, live deployment or regulatory finding. It gives no investment advice.

## Business model

Free for readers, students and educators. Later, paid tip feeds for newsrooms, built on the Coverage Gap Detector, and team dashboards for organizations that follow regulation in their field.

## Evaluation plan

Automated measures, produced by `scripts/eval.ts` and written to `docs/eval-results.md`:

- share of displayed claims with a matched quote (target 100%)
- unsupported claims removed
- coverage gaps found, items in "Beyond your watch", and disagreements surfaced
- average steps, tool calls, tokens and estimated cost per live run

Planned human evaluations. No results exist yet, and none are reported here.

1. Reader ratings of usefulness for grounded briefings, on a short survey after use.
2. A quiz comparison: readers see either a grounded briefing or an ordinary summary of the same sources, then answer recall questions and a transfer question about a new case.
3. Editor review time per briefing, measured in the review queue, to estimate the cost of human review.
4. Click-through to original sources, measured only in a consented study session, since the public site has no analytics.
