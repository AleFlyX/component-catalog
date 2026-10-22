---
name: component-catalog
description: Configure, query and maintain a local TypeScript component catalog. Use for initial setup, reusable component selection, or adding, changing, moving and deleting components in configured roots.
---

# Component catalog

Use the project's catalog as a discovery aid. Project architecture and runtime source remain authoritative. This skill does not provide the CLI binary: locate the existing package script, local dependency bin, or user-provided tool checkout before invoking it. Do not run an unrelated registry package by guessing its name.

Report validation results in the conversation. Keep ad hoc test fixtures, trial reports and local extraction notes outside the consumer repository; do not create or commit extra validation documents unless the user requests them or the project requires them. This does not exclude maintainable automated tests or requested product documentation.

## Existing configuration

Find the nearest `component-catalog.config.json` from the working directory, or use the project's explicit `--config` path. Read that small configuration and the relevant package scripts. Paths other than projectRoot are relative to projectRoot; projectRoot itself is relative to the config file. Avoid inventing `web/src/shared/ui` or other project-specific paths.

When choosing or adding a shared component, search a task, export name, or Prop name first. Get details by the returned exact ID, then inspect only the needed source or recommended examples:

```bash
component-catalog --config <config-path> search "task" --limit 5
component-catalog --config <config-path> get <exact-id>
component-catalog --config <config-path> get <exact-id> --prop <exact-prop-name>
component-catalog --config <config-path> get <exact-id> --include members,constraints
```

Substitute the actual local CLI command. Use `npm --silent run component -- ...` or `pnpm --silent component ...` for scripts when stdout must remain JSON. No need to query for a small fix at a known source location.

Do not routinely dump the full generated catalog. Search results are at most 4 KiB, details 16 KiB. Respect `truncated`, `omitted`, `selection.partial`, inheritedTypes and partial/unsupported schemaStatus. A missing catalog Prop may be inherited; inspect source instead of claiming the API is absent. --prop is case-sensitive and mutually exclusive with --include. Namespace entries use members.

Queries never regenerate or detect stale data. If a catalog is missing/stale and generation is within the requested work, follow the maintenance workflow below. For read-only review, report the missing evidence or use source. Empty search is not proof no reusable component exists: try export names, actual English task tags or configured vocabulary, then search source.

## Maintain during implementation

When authorized work adds, changes, moves or deletes a component in configured roots, or changes its referenced examples, read [references/maintenance.md](references/maintenance.md). Include catalog maintenance in the implementation; a known-file fix may skip discovery, but still needs freshness verification if it affects catalog inputs.

With configVersion 2, each root records enrollment policy. In `public` roots, annotate supported new public components without asking again whether to enroll each one. In `review` roots, use existing ownership rules and actual usage to enroll or explicitly ignore; ask only when that decision is unresolved. A policy does not authorize unrelated changes, broader public scope, commits or publication. Read-only requests remain read-only.

Finish authorized changes with `audit` → resolve findings → `generate` → `check`, plus representative queries and applicable project checks. These commands apply to the complete configured scope, independently of displayed pages. `audit/check` report exit 1 for findings and 2 when unable to complete; neither modifies sources or the catalog. Never suppress failures by removing existing markers or inventing metadata. v1 queries/generation still work, but lifecycle auditing requires explicit migration; see the maintenance reference.

## First-time setup or migration

Installing this skill alone does not scan or enroll anything. When the user requests setup, read [references/setup.md](references/setup.md) and take responsibility for discovery, configuration, metadata edits in the selected scope, and verification. The user chooses scope, not individual JSDoc fields.

Start with a read-only inventory, even before a config exists:

```bash
component-catalog scan <frontend-directory> --summary
component-catalog scan <selected-directory> --limit 20
component-catalog scan <selected-directory> --offset <nextOffset> --limit 20
```

Start broad discovery with --summary: it groups counts under each immediate child directory, including descendants, without loading every candidate into context. Drill into relevant directories, then use detail pages for enrollment. Detail results include unmarked candidates, missing metadata and unsupported syntax. These are heuristics, not evidence that an export is public. Paths are relative to the returned root, which may differ from projectRoot. Scan does not apply catalog configuration or exclusions. Follow nextOffset until null in the same view when reporting full coverage, or explicitly say the inventory is partial.

When the user has already selected directories/components for enrollment, proceed within that scope without another confirmation. Providing only the frontend location identifies where to inspect; it does not make every export public. If scope remains unclear, present a short directory/count/reason recommendation and ask one focused question with choices: recommended public directories, a user-specified subset, or inventory only. Do the read-only discovery before asking. Do not request permission per component.

After scope is settled, the Agent adds truthful annotations and verifies all selected supported entries. A first successful example is a checkpoint, not completion of a larger requested scope. Report discovered candidates, selected scope, enrolled entries, skipped entries and pending evidence with reasons; do not claim all components are searchable when only some are enrolled.
