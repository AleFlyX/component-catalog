# Maintain the component lifecycle

Use for authorized changes to components or their catalog inputs. No specific project layout, Git repository or CI provider is required. The consumer's configuration, architecture and current task determine scope.

## Decide once, maintain within scope

Read the actual config, relevant ownership rules and package scripts. If the config is v1, keep search/get/generate usable. For lifecycle coverage, migrate to configVersion 2 and select public/review for each root from existing decisions. Ask only when ownership policy cannot be inferred. Do not silently label every existing root public. Migration changes configuration, not catalog schemaVersion; regenerate instead of hand-editing generated JSON.

For an unresolved ownership or scope decision, use [scope decisions](setup.md#scope-decisions). Existing policy or an earlier user choice needs no reconfirmation.

| Situation | Agent action during authorized implementation |
| --- | --- |
| New supported public component in a public root | Add truthful metadata and a real example; no repeated enrollment question |
| Candidate in a review root | Use architecture and imports to decide public vs private; ask one focused question only for unresolved ownership |
| Private helper or non-component value export | Record an internal/non-component ignore reason on its declaration |
| Unmarked component with unsupported declaration syntax | Record unsupported with the specific limitation; preserve runtime code and disclose missing catalog coverage |
| Existing enrolled component loses metadata or becomes unsupported | Repair within scope or report the blocker; do not replace its marker with ignore just to pass |
| Component outside configured roots | Follow project rules; expanding catalog scope needs an established decision, not an automatic root addition |

Decisions live beside source, not in a separate registry:

```ts
/** @componentCatalogIgnore internal: used only by the parent field implementation */
export function FieldAdapter() { /* existing implementation */ }
```

Allowed categories are `internal: reason`, `non-component: reason`, and `unsupported: reason`. Each requires a substantive reason. A declaration cannot be both marked and ignored, or have repeated decision tags. CLI validation checks the form, not the truth of ownership or rationale; inspect source and usage. Explicit ignore does not enroll the entry. `ignoredUnsupported` is an acknowledged coverage limitation even if check passes. Do not exclude arbitrary folders or demote status to suppress failures.

Zero production consumers does not establish internal ownership. When reviewing such ignores, distinguish a genuinely private implementation detail from a public reusable export lacking an example. Complete available evidence within scope or report pending work and audit failures; do not reword the ignore to preserve a green result. Preserve established statuses; newly documented entries without a maturity decision start experimental.

Audit reports `IGNORE_REVIEW_REQUIRED` when an unsupported ignore now sits on a supported declaration shape, including after a tool upgrade adds support for an existing React memo wrapper. Re-read the source and ownership: enroll a public supported component with real metadata/examples; use internal/non-component only when that is its actual role. A supported shape does not prove full extraction or type validity. If another extraction limitation remains, report that concrete blocker rather than rewording unsupported to silence the finding. Check/generate remain blocked until the decision is resolved. Internal/non-component ownership is not automatically reclassified by the tool.

For new metadata, follow [setup.md](setup.md#annotate-selected-components). Props, defaults, imports, usage and schema context come from source; the Agent maintains summary/tasks/status/constraints/example references. Reuse actual examples, never fabricate paths or caller obligations. If required evidence is missing, report pending work; adding a production page or unrelated runtime refactor is not catalog maintenance.

## Changes, moves and removals

- API/default changes: review related description, constraints and examples. Regenerate derived Props; do not edit generated JSON.
- Move or rename: IDs depend on root-relative directories and export names, and import paths depend on filenames. Review consumer imports, example paths, project documentation and deprecated replacement IDs. There is no automatic ID migration map.
- Deprecation: use @catalogDeprecatedReason for a real retirement with no successor; when a successor exists, @catalogReplacement must point to an existing catalog ID and chains may not cycle. At least a reason or replacement is required; old replacement-only entries remain valid. A reason may accompany a replacement, but cannot make a broken replacement valid. Review reasons when status changes back to active. get retains the reason/replacement even when selecting one Prop or other fields.
- Delete: remove obsolete consumers/examples and replacement references within authorized scope, then regenerate. Deleting the final entry is valid in v2; retain an empty catalog only after audit finds no unresolved candidates.
- Barrel aliases: annotate the canonical declaration once. Audit resolves named/star aliases and ignores type-only exports. It reports unresolved, ambiguous and out-of-scope value exports. Review explicit external reexport ignores; they do not make the external API searchable.

## Verify the whole configured scope

Use the project's actual local CLI or script with the same config throughout:

```bash
component-catalog --config <config-path> audit
component-catalog --config <config-path> generate
component-catalog --config <config-path> check
component-catalog --config <config-path> search <affected-task-or-name>
component-catalog --config <config-path> get <affected-id> --prop <changed-prop>
```

Audit checks enrollment decisions, extractable metadata/examples, replacement references and obsolete stored IDs. It permits a missing snapshot on first setup; check additionally requires an up-to-date snapshot. Resolve substantive audit findings before generation. STALE_ENTRY after an intended removal/move is resolved by reviewing that removal and regenerating; don't re-add deleted components just to clear it. v2 generate audits source decisions before writing and can repair obsolete/corrupt snapshots. audit/check never write.

audit/check exit codes: 0 means no findings, 1 means findings exist, 2 means invalid input or unable to complete the command. JSON status/counts cover all findings even when output is truncated. Default 20 findings, maximum 50 requested, 8 KiB per page. Follow nextOffset with the same command/config and unchanged sources; pages may contain fewer than the requested count. Check omitted.fields when a diagnostic message itself is too long. Do not report success from an empty page or a subset of findings.

Run applicable consumer typechecks/tests/build as well: catalog check does not replace TypeScript or runtime validation. Verify affected search/get results and ID removal where relevant. If pre-existing findings are outside the requested change, disclose them and the scope needed to resolve them; do not silently expand the task. A read-only review may run audit/check but must not annotate or generate.

On tool upgrades, run doctor with this skill's expected CLI version before maintenance. This runtime generates schemaVersion 7 (nullable importPath and importExtension, JS/JSX paths, reuse boundaries and deprecationReason), while queries still read v3/v4/v5/v6 snapshots; v3/v4 reuse is unspecified. Regenerate through the CLI to migrate; old CLI readers cannot consume v7. Do not hand-edit schemaVersion. Configuration versions remain 1/2 and are independent of catalog format versions. Doctor pass is not a substitute for audit/check.

When moving components between roots or changing reuse policy, review the affected import sites against module ownership and project rules. Root reuse changes affect every entry under that root; `@catalogReuse` can override one enrolled component in a mixed directory. Both changes invalidate the snapshot. Do not broaden module scope to project solely to clear an integration problem. Audit/check validate metadata syntax and freshness, not architecture violations; report any unresolved ownership conflict separately.

## Integrate into the consumer workflow

When setup/integration is authorized, add scripts using the actual dependency/bin, bundled skill entry or checkout. A project-local skill can use `node .agents/skills/component-catalog/scripts/bin/component-catalog.mjs` (adapt the Agent directory); a user-global skill needs its actual absolute path and is a local-machine setup, not a portable team dependency. Keep dependency preparation separate from checks. For an installed local dependency, adapt this example to the config location:

```json
{
  "component": "component-catalog --config component-catalog.config.json",
  "component:generate": "component-catalog --config component-catalog.config.json generate",
  "component:check": "component-catalog --config component-catalog.config.json check"
}
```

Wire component:check into the project's existing routine check command. Do not put automatic generation in checks: that would hide stale committed artifacts. Keep generation an explicit implementation step. CLI can run by absolute path when no package manager is used; do not require Git or add CI infrastructure solely for this skill.

The short project pointer should also document the active installation and its one-time dependency command for a clean checkout. Ensure the project's documented Node version covers the CLI's Node >=22 requirement when integrating routine checks; report any incompatible constraint instead of silently changing an established runtime policy. Do not add a second tool checkout or install dependencies automatically during check.

If existing lint/test commands support an older Node version, chaining the catalog into them raises their requirement too; a README note does not preserve compatibility. Keep those commands intact and, where available, add a separate catalog step to an existing workflow using a compatible Node runtime. Otherwise report integration pending a runtime policy decision. Do not create new CI infrastructure solely to avoid that decision.

Add a short pointer in the applicable project instructions file, preserving existing rules. Adapt the path/command, for example:

> For reusable component selection and component changes, use `.agents/skills/component-catalog/SKILL.md`. Query with `npm --silent run component -- search <task>`, then get the exact ID. Maintain enrollment and metadata under each configured root's public/review policy; run `npm run component:generate` and `npm run component:check` after affected changes. Known-file fixes can skip discovery but must keep the catalog current.

This pointer helps the Agent find the skill; deterministic check catches omissions when it does not. Merely copying a skill cannot guarantee every Agent invokes it.

Finish with affected entries, enrollment/ignore decisions, applicable query results and actual checks. Disclose ignoredUnsupported and unresolved evidence. Preserve a single generated catalog; no persistent secondary decision list, automatic commit or publishing step.
