# Contributing

Thanks for considering a contribution. This project is a small ESM CLI with no build step; most changes need only `npm test`.

## Setup

```bash
npm ci
npm test
```

Node >= 22 is required. The only runtime dependency is TypeScript `5.9.3`, pinned in `package.json`; the CLI runs from source with no compilation.

## Where things live

| Path | Purpose |
| --- | --- |
| `bin/component-catalog.mjs` | CLI entry: argument parsing, command dispatch, output assembly |
| `lib/` | Library modules — config, scan, generate, query, audit, verify, doctor |
| `schema/catalog.schema.json` | Catalog JSON Schema; `schemaVersion` is pinned here |
| `skills/component-catalog/` | The installable skill: `SKILL.md`, `references/`, and a vendored copy of the CLI |
| `test/` | Node test-runner suites plus fixtures |
| `examples/basic/` | Minimal project that proves extraction without a browser runtime |

`skills/component-catalog/scripts/` is a **vendored copy** of `bin/` + `lib/` + `schema/` plus its own `package.json`. Keep it byte-identical to the root implementation; the distribution test copies the skill into a temp directory and runs it standalone.

## Commands

```bash
npm test        # full suite
npm run check   # node --check on the CLI, then tests
npm run build   # npm pack --dry-run: validates the publish manifest
```

Run `npm test` before opening a pull request. If you touched docs, the doc-lint suite runs as part of it.

## Changing behavior

| Change | Also update |
| --- | --- |
| A query flag or output field | `search`/`get` usage strings in `bin/`, `SKILL.md`, `README.md` and `README.zh.md` |
| A config field | `lib/config.mjs` template, `schema/`, `references/setup.md`, both READMEs |
| A catalog field | `schema/catalog.schema.json`, `lib/query.mjs`, the README output samples |
| The skill revision | `SKILL.md` frontmatter, `README.md`, `README.zh.md`, `llms.txt`, `references/setup.md` |
| The package version | `package.json` and both lockfiles; `test/metadata.test.mjs` enforces the rest |

`test/metadata.test.mjs` asserts that every surface agrees on the version and revision, and `test/docs.test.mjs` asserts there is exactly one owner per duplicated rule. Both fail loudly rather than letting a doc drift.

## Tests and fixtures

- `test/fixtures/multi-root/` covers multiple component roots, primitives and stub handling.
- `test/fixtures/airport-*/` are compressed catalogs for query-regression assertions.
- `test/baselines/` keeps the open-source baseline catalog.
- `test/audits/`, `docs/` and `.trial/` are local evaluation material and gitignored. Do not commit benchmark data, private trial artifacts or generated reports.

Fixtures are minimal on purpose. Add the smallest project that reproduces a behavior; do not copy a real consumer repository.

## Skill changes

The skill is vendored, so edits usually start in `bin/`/`lib/` and are copied into `skills/component-catalog/scripts/`. If you change instructions instead:

- Keep the frontmatter portable: `name`, `description`, and `metadata` only. Harnesses differ, and a non-standard key can make the skill unloadable.
- `description` states what the skill does, when to use it, and when not to. It is the only text most agents see before deciding to load the file.
- Keep each rule in one owner document and link instead of restating. `test/docs.test.mjs` enforces the `typeScope` case specifically.
- Bump `revision` when the instructions change meaningfully, then run `doctor --installation` and update every pinned `--expect-skill-revision`.

## Releasing

1. Update the version in `package.json` and both lockfiles.
2. Bump the skill revision if instructions changed, and update every surface listed above.
3. Run `npm test`, `npm run check`, `npm run build`.
4. Push the tag `v<version>`. CI verifies the tag matches the package version, runs the suite, and creates the Release with the tarball.
5. Publish to npm manually from `main`.

The tarball and the npm package carry identical contents. Never publish the repository's `test/` or `docs/` directories.

## Reporting issues

Include the CLI version (`--version`), the skill revision and content digest, the command you ran, and the JSON output. Do not paste source contents from a private repository.
