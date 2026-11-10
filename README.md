# Component Catalog — React/TypeScript Component Discovery for AI Coding Agents

[![test](https://github.com/AleFlyX/component-catalog/actions/workflows/test.yml/badge.svg)](https://github.com/AleFlyX/component-catalog/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@codecantbuild/component-catalog.svg)](https://www.npmjs.com/package/@codecantbuild/component-catalog)
[![license](https://img.shields.io/npm/l/@codecantbuild/component-catalog.svg)](LICENSE)

**English** · [简体中文](README.zh.md)

A local, bounded component catalog CLI for React/TypeScript codebases. It indexes components from source declarations and inline JSDoc, then lets an AI coding agent retrieve only the component, import path, Props, constraints and usage it needs — without reading the whole repository.

It is **not** a UI documentation site, a runtime component library, or an MCP server. It is a shell CLI over a saved JSON catalog.

| | |
| --- | --- |
| CLI | `0.5.0` |
| Skill revision | `14` |
| Config schema | `2` |
| Catalog schema | `7` |
| Node | `>=22` |
| Runtime dependency | TypeScript `5.9.3` only |
| License | [MIT](LICENSE) |

<details>
<summary><b>Table of contents</b></summary>

- [Why use it](#why-use-it)
- [Install](#install)
- [Quick start](#quick-start)
- [Query existing components](#query-existing-components)
- [Annotate components](#annotate-components)
- [Agent integration](#agent-integration)
- [Large repositories: `typeScope`](#large-repositories-typescope)
- [FAQ](#faq)
- [Known limitations](#known-limitations)
- [Development](#development)
- [License](#license)

</details>

## Why use it

AI coding agents are good at writing components and expensive at rediscovering an existing design system. Component Catalog gives them a bounded, project-specific index:

- **Find the existing component before creating a duplicate** — search by export name, task tag, vocabulary alias or Prop.
- **Get the integration facts, not the whole file** — ID, export, import path, required Props, constraints and usage counts.
- **Bound context in large monorepos** — query output is capped; `typeScope: "componentRoots"` avoids loading the server/lib/Prisma graph.
- **Keep the index verifiable** — `audit`, `check` and `verify` cover enrollment, freshness and representative queries.

Typical searches this project is designed for: *React component catalog*, *component discovery for AI agents*, *TypeScript component search*, *find component import path and props*, *bounded codebase context*.

## Install

Published to the npm registry as a public scoped package:

```bash
npm install @codecantbuild/component-catalog
npx @codecantbuild/component-catalog --version
```

Or install the GitHub Release tarball, which has identical contents and needs no registry:

```bash
npm install https://github.com/AleFlyX/component-catalog/releases/download/v0.5.0/codecantbuild-component-catalog-0.5.0.tgz
./node_modules/.bin/component-catalog --version
```

CI runs tests on every `v*` tag, verifies the tag matches the package version, packs and creates the Release. The npm package is published manually from the main branch.

## Quick start

Five minutes from a checkout to a queryable catalog. `examples/basic` is a minimal project that needs no browser runtime.

```bash
npm ci
node bin/component-catalog.mjs doctor --installation --expect-version 0.5.0 --expect-skill-revision 14
node bin/component-catalog.mjs scan examples/basic/src --summary
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json generate
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json search 按钮
```

`search` returns one bounded JSON object. Every item names the signal that matched it:

```json
{
  "items": [
    {
      "id": "demo.ui.Button",
      "exportName": "Button",
      "importPath": "@demo/ui/Button",
      "layer": "shared",
      "matched": "task",
      "requiredProps": ["label"],
      "tasks": ["button"],
      "status": "stable",
      "reuse": { "scope": "project" }
    }
  ],
  "truncated": false,
  "omitted": { "items": 0, "byLimit": 0, "byBytes": 0 }
}
```

`matched` is the important field: `task` means a task tag matched, `name` an ID or export name, `prop` a Prop name, and `summary` only that the word appeared in prose. Treat `summary` as the weakest signal.

When you need one API detail, ask for that detail rather than the whole component:

```bash
node bin/component-catalog.mjs --config examples/basic/component-catalog.config.json \
  get demo.ui.Button --prop disabled
```

```json
{
  "component": {
    "id": "demo.ui.Button",
    "importPath": "@demo/ui/Button",
    "constraints": ["Supply a short, actionable label."],
    "prop": {
      "name": "disabled",
      "displayType": "boolean | undefined",
      "required": false,
      "defaultValue": "false",
      "schemaStatus": "complete"
    }
  },
  "selection": { "kind": "prop", "name": "disabled", "partial": true }
}
```

## Query existing components

```bash
component-catalog search "form" --limit 5
component-catalog search rowKey --details
component-catalog get ui.forms.BusinessForm
component-catalog get ui.forms.BusinessForm ui.forms.CustomerPicker
component-catalog get ui.forms.BusinessForm --prop disabled
component-catalog get ui.forms.BusinessForm --from src/features/orders/Page.tsx
```

Rules that keep queries cheap and honest:

- Run one `search` first. When `--details` already returned `importPath`, `requiredProps` and the first constraint, do not call `get` to confirm them.
- Use `get` only for constraints, examples or full Prop context. Several IDs belong in one `get`, but never combine them with `--prop` or `--from`.
- For mixed intent use `--per-layer 3`; a single-layer catalog expands that default to 5. Use `--per-layer 5` only when a multi-layer catalog has many strong candidates in one layer.
- `--layer auto` suits single-intent queries only. A mixed query must return a `components` array covering every role, with missing roles marked explicitly.
- When no dedicated component exists but a general one clearly serves the role, return the general component with a caveat. Mark `missing` only when nothing in the domain serves it.
- On a weak or empty result, change the wording, use `--brief` or `--limit 10`, or fall back to `scan`. Never call `get` with a guessed ID.

Output is capped at 4 KiB for search and 16 KiB for `get`. `truncated` means byte capping; more matches than the limit appear as `omitted.byLimit`. Set `COMPONENT_CATALOG_LOG=<path>` to write a local JSONL usage log; it never records source content.

## Annotate components

```ts
/**
 * Renders the order form shell used by the orders feature.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask business-form
 * @catalogConstraint Submit state is owned by the caller.
 * @catalogExample production src/features/orders/Form.tsx | Order form
 */
export function BusinessForm(props: { disabled?: boolean }) { /* ... */ }
```

- `summary`, `status`, and at least one task, constraint and example are required.
- `experimental` may have no stable example; `stable` needs a production or preview example.
- Excluded candidates use `@componentCatalogIgnore internal|non-component|unsupported: <reason>`. Do not delete markers silently.
- After adding, changing, moving or deleting a component, run `audit → generate → check`. The full lifecycle lives in [maintenance.md](skills/component-catalog/references/maintenance.md).

## Agent integration

Copy the **whole** [skills/component-catalog](skills/component-catalog/SKILL.md) directory into the agent's skill location — not just `SKILL.md`. The directory carries the CLI, schema, references and dependency manifest.

```bash
npm ci --prefix "<skill-directory>/scripts" --ignore-scripts --no-audit --no-fund
node "<skill-directory>/scripts/bin/component-catalog.mjs" \
  doctor --installation --expect-version 0.5.0 --expect-skill-revision 14
```

The skill routes by intent: an ordinary query never loads the setup workflow, and a missing configuration is not permission to initialize a catalog. When scope is unclear the agent presents candidate directories, counts and a recommendation before asking.

For setup in a project whose users type Chinese, seed the template with `init --locale zh-CN`; summaries and task tags stay English either way. `init` never guesses a language.

Machine-readable project summary for crawlers: [llms.txt](llms.txt).

## Large repositories: `typeScope`

Choose `typeScope` before the first `generate`; it is a configuration decision, not a query flag.

| Project shape | Use |
| --- | --- |
| Small/medium, components import only project UI | `typeScope: "project"` (default) |
| Large monorepo importing a server/lib/trpc/Prisma graph | `typeScope: "componentRoots"` |

`componentRoots` loads only the component-root type graph; imports outside the roots become shallow `any` types. Local Props stay typed, inherited ones may be `any`/partial.

The full remediation contract — suppression defaults, `typeCheck` semantics and the `suppressedType*` report fields — is owned by [setup.md § Large-repository type scope](skills/component-catalog/references/setup.md#large-repository-type-scope). When generation runs out of memory, switch `typeScope` and regenerate rather than raising the heap, and state the type-fidelity tradeoff in your handoff.

## FAQ

**Is this a Storybook or a component documentation site?**

No. Storybook is a UI explorer and documentation surface. Component Catalog is a CLI that turns selected component declarations into a compact JSON index for coding agents. It does not render components or replace runtime checks.

**Is this an MCP server?**

No. It is a shell CLI with local files and bounded JSON output. It can be invoked by any agent or script that can run a command; no editor extension or MCP transport is bundled.

**Does it work with Claude Code, Cursor, Codex or other coding agents?**

It is agent-agnostic: the integration surface is the CLI plus the bundled [SKILL.md](skills/component-catalog/SKILL.md). Agent-specific installation and permissions are managed by the host.

**Does it reduce token usage?**

In the local airport benchmark (5 tasks, 3 runs), reading source used about **462.8K total tokens**, while `catalog-details` used about **100.2K** — roughly **78% fewer** in that setting. This is a local benchmark with a 30-entry scoped catalog, not a universal guarantee; setup cost and task shape matter. Benchmark data is intentionally kept out of the public repo.

**Does it index the entire repository?**

No. It indexes supported JS/JSX/TS/TSX declarations in explicitly configured component roots, and requires a decision for candidates. Routes, pages, unsupported formats and unselected components may be excluded; `discovery.status=partial` reports acknowledged gaps.

**Does querying modify source or the catalog?**

No. `search` and `get` are read-only. `generate` writes the catalog; `audit`, `check` and `verify` do not regenerate it.

**Why did a component get enrolled but stay unfindable in Chinese?**

Because enrollment and vocabulary are separate concerns. A component is searchable by its English task tag immediately, while an ordinary-language query needs a `vocabulary` entry mapping that wording to the tag. `audit` reports such tasks under `discovery.unreachablePrimaryTasks`; it is advisory, so nothing fails.

## Known limitations

- Only PascalCase value exports, default exports and explicitly marked declarations in JS/JSX/TS/TSX are scanned. Vue, Svelte, MDX, cross-file HOCs and anonymous default exports may be unsupported.
- Props extraction depends on TypeScript. Complex generics, unions and inheritance may be `partial`/`unsupported`; `any` or empty fields do not prove a component accepts no Props.
- `typeScope: "componentRoots"` is an explicit memory/fidelity tradeoff, not a full type check.
- The catalog is a discovery aid; project architecture, runtime code and the project's own checks remain authoritative.

For installation detail, configuration contract, boundaries and troubleshooting, see [setup.md](skills/component-catalog/references/setup.md).

## Development

```bash
npm test        # 117 tests
npm run check   # syntax + tests
npm run build   # packaging manifest
```

Contribution rules, fixture layout and release steps live in [CONTRIBUTING.md](CONTRIBUTING.md). Documentation ownership and the single-source-of-truth map live in [AGENTS.md](AGENTS.md).

Cross-agent evaluation method: [evaluation.md](skills/component-catalog/references/evaluation.md). Concrete tasks, answers and fixture paths stay outside the SKILL; evaluation data lives in the gitignored `test/audits/`.

## License

[MIT](LICENSE) © 2026 AleFlyX
