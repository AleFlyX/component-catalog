# Extraction provenance

Created 2026-10-22 from the user's local CodeCampus working tree at `/home/ccb/online-judge`. Its HEAD was `819cc003b293b1537b65572a9095c3e498d00c90`; the query CLI and frontend skill also contained uncommitted Prop-query improvements. This repository intentionally copies that working-tree version, not just HEAD.

| Original source | SHA-256 at extraction |
| --- | --- |
| scripts/component-catalog.mjs | 4b0ebad29f764ea82ef49706d2a4ae5b70dd40b31493a7c5fd8040edb21f7b27 |
| scripts/component-catalog-schema.mjs | d463340df2358ff8e9e8707c45f86bc91a5263d4952f46c74f1e2b90d0d8e12a |
| scripts/component-catalog-source.mjs | 68b744f127159c5d0c7e56af7a16bc1a484bf4e7a976081720ef185a62a78f0f |
| scripts/generate-component-catalog.mjs | 5c52c3828ef6449e92dd9c2c1172a3d0b4746d0809def116a430fc957e799dee |
| config/architecture/component-catalog.schema.json | 917775277c616799e958ec0b2cb7089af78ff736a8a099874a37880efb2b621e |
| .agents/skills/react-frontend-structure/SKILL.md | 1cb5c3629d74c330269f2a0fdf1726a6009400a33fa83dd1a93688bd7d499f34 |

The standalone skill extracts component setup/discovery guidance only; OJ-specific architecture, requirements and governance are not copied. The generator and schema are generalized, and the protocol version is now 3. No third-party implementation is vendored. TypeScript is an npm dependency governed by its own package license. This local extraction does not establish a new open-source license for the copied project code; select an appropriate license before public distribution.
