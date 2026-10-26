---
name: component-catalog
metadata:
  revision: "9"
description: Configure, query and maintain a local React component catalog from JavaScript or TypeScript. Use for requested catalog setup, reusable component selection, or component changes in configured roots. Unrelated business work does not require catalog setup or migration.
---

# Component catalog

Use the catalog as a discovery aid; project architecture and runtime source remain authoritative. This skill bundles its CLI at `scripts/bin/component-catalog.mjs`, relative to this file. Prefer the project's existing compatible command. Otherwise use Node >=22 and the actual bundled path; never guess a registry package or project directory.

## Choose the workflow

| Current task | Action |
| --- | --- |
| Select an existing component or answer an API question | Use the query workflow below. No installation, generation or migration for a read-only request. |
| Add/change/move/delete a component in configured roots, or change its examples | Read [maintenance.md](references/maintenance.md), maintain affected metadata and verify freshness. A known-file fix can skip discovery. |
| Requested first setup, scope expansion or migration | Read [setup.md](references/setup.md). Inspect first; the Agent configures and annotates the selected scope. |
| Unrelated business work or an explicit pause of catalog work | Stay within the requested scope; do not initiate catalog setup, upgrade or migration. Existing project checks may still require catalog maintenance. Report such failures without disabling checks or claiming they passed. |

Read supporting instructions for the selected workflow; ordinary queries need neither setup nor maintenance instructions. Missing configuration is not permission to initialize a catalog. Respect an explicit pause of catalog work rather than treating this skill as authority to resume it.

## Query existing components

Find the nearest `component-catalog.config.json`, or use the project's explicit config path. Read that small configuration and relevant package scripts. `projectRoot` is relative to the config; other configured paths are relative to projectRoot.

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

Keep the query budget small: start with one search; if its `importPath` and `requiredProps` answer the task, do not call get. Get only when you need constraints, examples or type details that are absent from the search response, and reuse that response instead of fetching the same ID again. Do not call get merely to confirm an ID, importPath or requiredProps that `--details` already returned; that is a budget failure. When several components need details, pass 2–5 IDs to one get command. Use `--details` on a search when the first constraint or production/preview/test usage counts are needed; use `--include props` only when you need the prop-name index and `--prop` for one property. Do not inspect the config, run `--help`, or explore with shell commands during a normal query; invoke the documented CLI command directly. When a catalog mixes shared UI with feature components, use `--layer feature` for page/feature tasks and `--layer shared-ui` for primitives to avoid unrelated candidates. If unsure which layer to use, pass `--layer auto` only for single-intent queries; for mixed-intent queries use `--per-layer 3` to see the top results from each layer. For a mixed request, verify every requested role appears in the result; if one component is missing, report that explicitly rather than answering only the first match. Add `--layer-fallback` when the layer guess may be wrong; the response marks `layerFallback: true` if it retried without the filter.

- Search is limited to 4 KiB; detail to 16 KiB; batch detail shares the 16 KiB budget across 1–5 IDs. `truncated` means the response lost fields/items to the byte cap; more matches than `--limit` appear as `omitted.byLimit`, not `truncated`. Respect `omitted`, `selection.partial`, inheritedTypes and partial/unsupported schemaStatus. An absent catalog Prop may be inherited or untyped; `any`/`unknown` and empty extracted fields do not prove the component accepts no Props. Inspect source before declaring an API unavailable.
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

## Installation and upgrade diagnosis

Skill revision **9** targets CLI **0.3.0**. For authorized installation/upgrade, use the active bundled entry:

```bash
node <skill-directory>/scripts/bin/component-catalog.mjs doctor --installation --expect-version 0.3.0 --expect-skill-revision 9
```

With configuration, replace `--installation` with `--config <config-path>`. Doctor is read-only: readiness does not prove enrollment, freshness or routine-check integration. Keep CLI and instructions from one pinned source; do not change revision numbers to bypass a mismatch. For missing dependencies or an incomplete copy, follow [setup.md](references/setup.md#install-and-diagnose) within authorized installation work.

## Decisions and completion

Reuse established scope and enrollment policies. Supported new public components in a `public` root are maintained without asking per component; `review` roots need a source-based ownership decision. Selecting business components does not make them globally reusable. Only unresolved scope/ownership choices need a user decision: prefer the client's eligible structured choice tool, asynchronous when available. See [scope decisions](references/setup.md#scope-decisions) when needed; no timeout or preselected option constitutes consent.

For authorized maintenance, finish with `audit` → resolve findings → `generate` → `check`, affected queries and applicable project checks. Never invent metadata, remove markers or narrow roots to conceal failures. Setup additionally verifies useful search coverage and persistent workflow integration. Report `discovery` separately from audit status; unsupported exclusions are still unavailable even when checks pass.

Report actual validation in conversation. Keep ad hoc trials and reports outside consumer repositories; maintainable tests and requested product documentation are allowed. No extra registry, automatic commit or publication is part of this workflow.
