---
name: component-catalog
metadata:
  revision: "14"
description: Configure, query and maintain a local React component catalog from JavaScript or TypeScript. Use for requested catalog setup, reusable component selection, or component changes in configured roots. Unrelated business work does not require catalog setup or migration.
---

# Component catalog

Use the catalog as a discovery aid; project architecture and runtime source remain authoritative. This skill bundles its CLI at `scripts/bin/component-catalog.mjs`, relative to this file. Prefer the project's existing compatible command. Otherwise use Node >=22 and the actual bundled path; never guess a registry package or project directory.

## Choose the workflow

| Current task | Action |
| --- | --- |
| Select an existing component or answer an API question | Use the query workflow below. No installation, generation or migration for a read-only request. |
| Add/change/move/delete a component in configured roots, or change its examples | Read [maintenance.md](references/maintenance.md), maintain affected metadata and verify freshness. A known-file fix can skip discovery. |
| Requested first setup, scope expansion or migration | Read [setup.md](references/setup.md). Inspect first; the Agent configures and annotates the selected scope. Seed the template with `init --locale en` or `init --locale zh-CN` matching the language users actually type; `init` never guesses it. |
| Unrelated business work or an explicit pause of catalog work | Stay within the requested scope; do not initiate catalog setup, upgrade or migration. Existing project checks may still require catalog maintenance. Report such failures without disabling checks or claiming they passed. |

Read supporting instructions for the selected workflow; ordinary queries need neither setup nor maintenance instructions. Missing configuration is not permission to initialize a catalog. Respect an explicit pause of catalog work rather than treating this skill as authority to resume it.

## Query existing components

Find the nearest `component-catalog.config.json`, or use the project's explicit config path. Read that small configuration and relevant package scripts once, before the first query in a project, so `projectRoot` and the configured paths resolve correctly; `projectRoot` is relative to the config and every other configured path is relative to projectRoot. Re-read it when a query fails on paths or when you need to explain catalog behavior. Do not re-inspect it during routine queries.

Search by task, export name or Prop name, get an exact returned ID, then read the necessary source and recommended example:

```bash
component-catalog --config <config-path> search "task" --limit 5
component-catalog --config <config-path> get <exact-id>
component-catalog --config <config-path> get <exact-id> <other-id> <third-id>
component-catalog --config <config-path> get <exact-id> --prop <exact-prop-name>
component-catalog --config <config-path> get <exact-id> --include members,constraints
component-catalog --config <config-path> get <exact-id> --from src/features/Target.tsx
```

Substitute the actual local command. Use silent package-runner output when JSON is needed, for example `npm --silent run component -- ...` or `pnpm --silent component ...`. Do not routinely read the full generated catalog.

- **Budget:** one search first. If its `importPath` and `requiredProps` answer the task, do not call get. Get only for constraints, examples or type details the search response lacks, and never re-get an ID you already have. `--details` exists so one search can replace a follow-up get.
- **Batching:** when several components need details, pass 2–5 IDs to one get command. Use `--include props` only for the prop-name index, and `--prop` for one property.
- **Layer selection:** for a catalog that mixes shared UI with feature components, use `--layer feature` for page tasks and `--layer shared-ui` for primitives. `--layer auto` is for single-intent queries only; for mixed intent use `--per-layer 3`. In a single-layer catalog that default expands to 5 so a same-layer second role is not starved; use `--per-layer 5` explicitly when a multi-layer catalog has more than three strong candidates in one layer. Add `--layer-fallback` when the layer guess may be wrong; the response marks `layerFallback: true` if it retried without the filter.
- **Mixed requests:** enumerate the requested roles before answering. Every role needs a component ID or an explicit missing marker in a `components` array; never answer only the first component. If the exact role has no dedicated component but a general one clearly serves it in the same domain (a general traveler-booking detail screen for a special-passenger booking detail), return the general component with an explicit caveat. Mark missing only when no catalog component serves the role, or only a narrower or different domain remains.

- Search is capped at 4 KiB and detail at 16 KiB; batch detail shares the 16 KiB across 1–5 IDs. `truncated` means the response lost fields or items to the byte cap, while more matches than `--limit` appear as `omitted.byLimit`; they are different signals.
- Respect `omitted`, `selection.partial`, `inheritedTypes` and a partial or unsupported `schemaStatus`. An absent catalog Prop may be inherited or untyped, and `any`/`unknown` or empty extracted fields do not prove the component accepts no Props. Inspect source before declaring an API unavailable.
- Each result reports `matched`: `name` (exact or substring of ID/export name), `task` (task tag, including expanded vocabulary), `summary` (the word merely appeared in prose), or `prop` (a Prop name). Treat `summary` as the weakest signal: it does not prove the component serves the task, so widen the query or scan source before recommending it. A single weak hit is not a confirmed candidate.
- `--prop` is exact and case-sensitive, mutually exclusive with `--include`. Namespace entries use members, not Props.
- If importPath is null, use `get --from <caller-file>` to derive the relative import. The caller path is relative to projectRoot, not the current shell directory, and may name a planned file. Respect importContext and exportKind. This only computes a path from the saved snapshot; it does not check freshness, read the caller, enforce ownership, or prove bundler/runtime compatibility. Existing module aliases remain unchanged when --from is supplied.
- Compare `reuse` with the target module and project rules: `project` still respects architecture, `module` requires the same owner, `unspecified` means unknown. Search neither filters by caller nor enforces imports.
- Empty or unsuitable results do not prove no reusable implementation exists. Use the fallback below when candidates do not satisfy the task, results are truncated, or the relevant category is missing. Queries never regenerate or check freshness.
- For a missing/stale/incompatible catalog in a read-only task, report the limitation and use source. Repair or migrate only within authorized work using the matching workflow above; preserve project-specific tools rather than replacing them automatically.

## Discover beyond the catalog

Try alternate names/task tags and, when useful, `search --limit 10 --brief`; `--brief` omits summaries so more candidates fit, then get the chosen ID. If the catalog is insufficient, use the bare CLI (without a script's fixed `--config`) to inspect relevant source directories:

```bash
component-catalog scan <relevant-directory> --query "Dialog" --limit 20
component-catalog scan <relevant-directory> --query "Dialog" --offset <nextOffset> --limit 20
```

`--query` matches names, paths, JSDoc summaries and task tags; all whitespace-separated terms must match. It does not expand Chinese vocabulary or understand arbitrary requests: translate task wording into likely names/tags using project evidence, and try synonyms separately. Start with the relevant configured root, then inspect relevant frontend directories within the user's task scope even if they are outside catalog roots. Discovery does not expand enrollment or reuse permission.

Candidates include unmarked, ignored and unsupported declarations. Check their path, line, missingMetadata and shape/ignore reasons, then inspect source and consumers before recommending reuse. A marker is not proof of a valid saved catalog entry; do not pass a guessed candidate ID to `get`. Keep candidate findings distinct from verified catalog results. Follow pagination before claiming full matching coverage; counts describe the whole scanned directory, while matchingCandidates describes the filtered set.

If scanning is inconclusive, use `rg` or equivalent on source/imports, including private declarations, export-star barrels and source formats beyond JS/JSX/TS/TSX. Narrow a scan that fails on unrelated syntax. Missing documentation may block enrollment but must not block source inspection. Read-only discovery never adds annotations, generates artifacts or changes ownership. Report remaining uncertainty instead of claiming no component exists.

## Large repositories and type scope

Choose `typeScope` before the first `generate`; it is a config decision, not a query flag.

| Project shape | Use | Why |
| --- | --- | --- |
| Small/medium React project, components import only project UI | `typeScope: "project"` (default) | Full dependency types and inherited Props |
| Large monorepo where components import a server/lib/trpc/Prisma graph | `typeScope: "componentRoots"` | Loads only the component-root type graph; imports outside roots become shallow any-types |

If `generate` runs out of memory, approaches 2 GB, or its compiler program pulls server packages into a UI catalog, switch to `componentRoots` and regenerate under the default Node heap. The remediation contract, the suppression defaults, `typeCheck` tradeoffs and the report fields live in [setup.md](references/setup.md#large-repository-type-scope). Report the tradeoff explicitly: local Props stay typed, Props inherited from modules outside the roots may be `any`/partial.

## Decision consistency

Separate deterministic tool behavior from semantic choices:

- **Tool-enforced:** `--per-layer` overrides `--limit`; a single-layer catalog expands the default `--per-layer 3` to 5; compact CJK vocabulary matching and nested-concept ranking; `get`/search byte caps.
- **Agent decisions:** `typeScope`, vocabulary aliases, one-search/get budget, closest-general fallback, and mixed-role `components`. These depend on project ownership and acceptable type loss, so the tool must not silently guess them.

For setup, decide in this order: component roots and enrollment, `typeScope`, vocabulary languages/aliases, then representative mixed/missing queries. Record the choices and limitations in the handoff. If a later agent cannot tell which mode was used, read the config and the saved catalog/props rather than inferring from a query result.

## Installation and upgrade diagnosis

Skill revision **14** targets CLI **0.5.0**. For authorized installation/upgrade, use the active bundled entry:

```bash
node <skill-directory>/scripts/bin/component-catalog.mjs doctor --installation --expect-version 0.5.0 --expect-skill-revision 14 --expect-skill-content sha256:<digest>
```

`--expect-skill-content` pins the digest of the bundled instruction files (`SKILL.md` plus `references/*.md`). Revision numbers are shared names: a fork that splits a section into a new reference file keeps the number while changing the instructions, and `--expect-skill-revision` cannot tell the two apart. Pin the digest whenever a downstream copy may be locally adapted, and record it beside the checkout.

With configuration, replace `--installation` with `--config <config-path>`. Doctor is read-only: readiness does not prove enrollment, freshness or routine-check integration. Keep CLI and instructions from one pinned source; do not change revision numbers to bypass a mismatch. For missing dependencies or an incomplete copy, follow [setup.md](references/setup.md#install-and-diagnose) within authorized installation work.

For maintainer comparisons across agents or models, use [evaluation.md](references/evaluation.md). Keep concrete benchmark prompts, expected answers and fixture paths outside this skill; do not treat an evaluation prompt as a user task or add it to the normal query path.

## Decisions and completion

Reuse established scope and enrollment policies. Supported new public components in a `public` root are maintained without asking per component; `review` roots need a source-based ownership decision. Selecting business components does not make them globally reusable. Only unresolved scope/ownership choices need a user decision: prefer the client's eligible structured choice tool, asynchronous when available. See [scope decisions](references/setup.md#scope-decisions) when needed; no timeout or preselected option constitutes consent.

For authorized maintenance, finish with `audit` → resolve findings → `generate` → `check`, then `verify --suggest --out <queries.json>` to create starter export/task queries plus exact-name, task-based and vocabulary-based mixed queries when safe, add at least one natural-language mixed-role and one missing/edge case, and run `verify --queries <file> --out <report.json>`. `verify` checks the saved snapshot; run `check` first so it is not stale. Stdout is failure-focused by default (`--out` keeps the full report, `--details` prints all results). Report failed query IDs/roles instead of treating a successful generate as setup completion. Never invent metadata, remove markers or narrow roots to conceal failures. Setup additionally verifies useful search coverage and persistent workflow integration. Report `discovery` separately from audit status; unsupported exclusions are still unavailable even when checks pass.

Report actual validation in conversation. Keep ad hoc trials and reports outside consumer repositories; maintainable tests and requested product documentation are allowed. No extra registry, automatic commit or publication is part of this workflow.
