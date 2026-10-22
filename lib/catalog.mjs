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
  if (catalog?.schemaVersion !== 3)
    throw new Error(`Unsupported catalog schemaVersion; expected 3; run ${regenerate}`);
  const schema = JSON.parse(
    fs.readFileSync(new URL("../schema/catalog.schema.json", import.meta.url), "utf8"),
  );
  try {
    validateSchemaValue(catalog, schema, schema);
    if (new Set(catalog.components.map(({ id }) => id)).size !== catalog.components.length)
      throw new Error("Catalog requires components with unique IDs");
  } catch (error) {
    throw new Error(`Invalid catalog at ${file}: ${error.message}; run ${regenerate}`);
  }
  return catalog;
}
