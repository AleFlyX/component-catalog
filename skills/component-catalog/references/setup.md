# First-time enrollment

Use this workflow when the user requests setup or expands the selected catalog scope. Adapt to existing project conventions; do not ask the user to hand-author the configuration or JSDoc that the Agent can derive.

## Inspect and choose scope

Locate the actual tool checkout or installed local bin. If only the skill is installed and no CLI is available, say what is missing and ask for the tool location or offer the documented local-install method. Do not guess a registry package or repeatedly retry a missing command. Use command-specific --help when syntax is unclear; init only prints a template. If a project script always injects --config, call the bare CLI for scan/init, which do not use configuration.

Inspect package scripts, application tsconfig/extends, existing aliases, component ownership rules and example conventions. Run scan against the user-provided frontend directory before changing sources. The scanner needs no frontend dependencies or markers. It considers exported PascalCase functions/value declarations and some unsupported export forms; classes, wrappers and reexports may appear as unsupported. Ordinary functions/constants can be false positives. Plain .ts/.tsx are scanned; .d.ts, node_modules, .git and descendant symlinks are skipped. JavaScript-only or other-framework trees need source inspection, not a claim of zero components.

Use paths, real import sites and project architecture to recommend public component directories. Begin with scan --summary on a broad frontend tree; its immediate-child groups include descendants, and '.' represents root-level files. Drill into likely public directories before requesting detail pages. Do not read all frontend candidates merely to count directories. Do not recommend all pages, feature-private widgets or test/preview exports merely because scan lists them. Present a small table: directory, candidate count, existing markers, unsupported count and reason for recommending/excluding it. Counts must describe the reviewed scope; pagination or unread sources mean partial evidence. Scan has no config-based filtering, so inspect only relevant directories for a focused inventory and resolve its sourcePath against its returned root. Keep the same view and directory across nextOffset pages; restart pagination after source edits.

If the user already explicitly selected enrollment scope, continue. Otherwise ask one concrete choice after discovery, e.g. “Found public UI candidates under src/components and business-only views under src/features. Enroll the recommended public directory, choose a subset, or keep this read-only?” Include real paths/counts rather than generic questions. Existing setup authorization covers ordinary configuration/annotation edits in that chosen scope. Do not add an extra approval step for each batch or component. Inventory-only requests end with findings and no writes.

## Configure from the project

Preserve existing config and package scripts; edit only what is needed. Use configVersion 2:

- projectRoot is relative to the config file; sourceRoot, tsconfig, catalog and array paths are relative to projectRoot. sourceRoot is one source tree, with separate configs for independent applications.
- componentRoots are disjoint reviewed scopes with path, stable idPrefix, importPrefix, layer and enrollment. Set enrollment to public for an already agreed public component scope, or review for mixed ownership where each candidate needs a reasoned decision. Do not infer public policy from a folder name alone. Each path is within sourceRoot. importPrefix must match a real alias/package subpath, with no trailing slash. IDs are derived from root-relative directories and export names; imports from relative filenames, without barrel inference. Do not invent runtime aliases or move components to satisfy the tool.
- catalog is a dedicated .json output, preferably outside sourceRoot. Never point it at a source/configuration file. Explicit generate overwrites this output; --check is read-only.
- exclude, previewRoots and testRoots use project-relative paths inside sourceRoot, not globs. Outputs outside sourceRoot need no exclusion. previewRoots/testRoots cannot overlap.
- vocabulary maps relevant user terms to actual primary/related task tags. Add useful language terms based on the enrolled components; no built-in taxonomy or arbitrary natural-language understanding is assumed.

If an alias or ownership decision cannot be inferred, ask that specific missing question while continuing independent work. A directory name alone does not establish a public import contract.

## Annotate selected components

The Agent performs the metadata edits. Preserve existing JSDoc and runtime code. For each selected supported entry, inspect its declaration and actual uses, then add or complete:

```ts
/**
 * A factual summary of what this public component does.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask actual-task-tag
 * @catalogConstraint A real caller obligation established by the source or project contract.
 * @catalogExample preview src/previews/example.tsx | A real, relevant use
 */
```

This is a shape example, not text to paste verbatim. Every entry needs summary, marker, one status and at least one task, constraint and example. The first task is primary. Use established lifecycle status; when none exists, experimental is the conservative initial status and should be reported as such. Do not label an entry stable merely because extraction passed. Stable requires a production/preview example; deprecated requires @catalogReplacement.

Examples are projectRoot-relative TS/TSX paths and must really reference the export as a value. Classify production/preview/test/story according to config and filename conventions. Reuse existing examples/consumers where possible. If no example exists, add an appropriate local test/preview only when it fits the authorized setup and existing conventions; do not create a production route for catalog metadata. Missing evidence is a pending item, not permission to invent a restriction or fictitious path. If no meaningful constraint can be established, report that entry as pending under the current required-constraint contract rather than inserting filler.

Do not add a marker to a declaration known to be unsupported. Direct memo/forwardRef/HOC results, anonymous defaults and export-list-only entries currently need tool support. Record a truthful @componentCatalogIgnore unsupported: reason on an unmarked declaration and report the limitation; do not rewrite runtime behavior to pass. For private helpers or non-component PascalCase constants, use internal: reason or non-component: reason. The marker and ignore tag are mutually exclusive. Already marked unsupported declarations fail generation: fix only within authorized scope, without silently deleting existing metadata. See [maintenance.md](maintenance.md) for the decision contract. supportedShape=true and an empty missingMetadata list do not prove valid types, tags or example bindings.

Use audit for full configured coverage after scan's heuristic discovery. Resolved aliases and export-star barrels do not need duplicate annotations; annotate the original supported declaration. Unresolved, ambiguous or out-of-scope value reexports require investigation. Type-only exports are not components. A genuine external reexport can carry an explicit ignore reason at its export statement. Unsupported source formats and skipped symlinks are coverage findings, not proof of an empty component scope.

Verify one representative entry first when it helps catch configuration errors, then continue through the full selected scope. Preserve private components and user edits. Keep a temporary reasoning tally or final report, not a second persistent registry.

## Verify and hand off

Run audit and resolve enrollment/metadata findings, then generate, representative task/name/Prop searches, get, a focused --prop where useful, and check. Also query from another cwd with explicit --config to catch path assumptions. Confirm expected source/import paths, generic type context, output omissions and that queries do not modify the catalog. Run applicable project checks for annotations or added examples; report what actually ran. When integration is in scope, add generate/check scripts and a short project instructions pointer using [maintenance.md](maintenance.md). check covers missing enrollment as well as freshness; v1 generate --check alone cannot catch unmarked additions.

On failure, use the concrete path and next action in the error. No markers with undecided candidates means review and annotate, not endlessly retry generate. v2 allows zero entries only if auditing has no unresolved candidates; ignored entries remain visible in counts. Missing catalog means explicit generation; an empty search may mean missing vocabulary or an unindexed inherited Prop. Search names/tags and inspect source before concluding the component does not exist.

Finish in the user's language with the selected directories and a compact coverage report: discovered candidates, selected candidates, generated entries, skipped items/reasons and pending evidence. Reexports can refer to the same underlying component; do not present raw candidate counts as unique components. Provide working commands that include the actual script/bin and config path, plus the regeneration/check command. If only a subset is ready, say exactly which subset is usable. Do not claim completion merely because generate passed.
