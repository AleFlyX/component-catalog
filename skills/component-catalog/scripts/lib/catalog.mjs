import fs from "node:fs";
import { validateSchemaValue } from "./schema.mjs";

export function loadCatalog(file, regenerate = "component-catalog generate") {
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      error.code === "ENOENT"
        ? `Catalog missing at ${file}; run ${regenerate}`
        : `Cannot read catalog JSON at ${file}; run ${regenerate}`,
    );
  }
  if (![3, 4, 5, 6, 7].includes(catalog?.schemaVersion))
    throw new Error(`Unsupported catalog schemaVersion; expected 3, 4, 5, 6 or 7; run ${regenerate}`);
  const schema = JSON.parse(
    fs.readFileSync(new URL("../schema/catalog.schema.json", import.meta.url), "utf8"),
  );
  schema.properties.schemaVersion.const = catalog.schemaVersion;
  if (catalog.schemaVersion < 7) {
    schema.$defs.component.required = schema.$defs.component.required.filter((key) => key !== "importExtension");
    delete schema.$defs.component.properties.importExtension;
    schema.$defs.component.properties.importPath = { type: "string", minLength: 1 };
  }
  if (catalog.schemaVersion < 6) {
    const legacyPath = "^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$)).+\\.(ts|tsx)$";
    schema.$defs.component.properties.sourcePath.pattern = legacyPath;
    schema.$defs.example.properties.path.pattern = legacyPath;
  }
  // Older snapshots remain queryable without inventing their reuse boundary.
  if (catalog.schemaVersion < 5) {
    schema.$defs.component.required = schema.$defs.component.required.filter(
      (key) => key !== "reuse",
    );
    delete schema.$defs.component.properties.reuse;
  }
  if (catalog.schemaVersion === 3) {
    delete schema.$defs.component.properties.deprecationReason;
  }
  try {
    validateSchemaValue(catalog, schema, schema);
    if (new Set(catalog.components.map(({ id }) => id)).size !== catalog.components.length)
      throw new Error("Catalog requires components with unique IDs");
  } catch (error) {
    throw new Error(`Invalid catalog at ${file}: ${error.message}; run ${regenerate}`);
  }
  return catalog;
}
