# Catalog evaluation runs (maintainers)

Use this only to measure agent behavior or compare strategies. It is not part of normal component selection, setup, or migration instructions.

## Keep evaluation separate from the skill

Do not add the concrete task prompts, expected answers, fixture paths, or model-specific wording to `SKILL.md`. Those details:

- leak the test set and encourage vocabulary/ranking overfitting;
- make the skill longer without changing normal task execution;
- become stale when the trial repository changes.

Keep task sets and expected answers under the trial/audit directory. The skill should contain the invariants, not the questions.

## Freeze the fixture

Record before running:

- repository and commit;
- catalog/config path and `sourceDigest`;
- component roots and `typeScope`;
- Node/CLI/skill revision;
- which tasks were used for tuning and which are held out.

Do not edit vocabulary, annotations, ranking, or the trial source between repetitions.

## Prompt template

Use one task per search. Replace only the placeholders:

```text
Work in <project-root>; do not modify files.
Use:
cd <project-root> && COMPONENT_CATALOG_LOG=<run-log> COMPONENT_CATALOG_TASK=<task-id> \
node <cli> --config <config> search "<task terms>" --limit 5 --details --per-layer <3-or-5>

Catalog-only: do not read the catalog JSON, config, source, help, or use ls/cat/grep.
Exactly one search for this task; no get and no second search.
If a component is absent from that one result, report missing rather than guessing.
For a mixed request, enumerate the roles and put every role in a components array,
with componentId/importPath/requiredProps or an explicit missing marker.
Write <result-path> with <schema>.
```

For a single-layer catalog, `--per-layer 3` now auto-expands to 5; do not ask the agent to remember a special flag. For a multi-layer catalog, use 3 unless more than three strong candidates share a layer.

## Acceptance checks

- Every task has exactly one search and zero gets; counts match the usage log.
- Mixed task components cover every requested role, including explicit missing roles.
- No config/source/help/ls/cat/grep reads, unless the tested strategy explicitly allows them.
- Report scores, token totals, tool calls, sourceDigest, and protocol deviations.
- Run at least three repetitions; a single 5/5 or 100% is not stability evidence.
- Treat `missing` as correct only when the catalog/source proves absence, not when one query returns no hit.

## What belongs in SKILL.md instead

Keep only durable execution rules there: budget, mixed-role contract, closest-general, per-layer behavior, `typeScope` decision, and reporting limitations. The evaluation template stays here so normal agents do not mistake benchmark prompts for user instructions.
