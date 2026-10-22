export function validateSchemaValue(value, schema, rootSchema, location = "$") {
  if (schema === false) throw new Error(`${location}: forbidden property`);
  if (schema === true) return;
  const supportedKeywords = new Set([
    "$schema",
    "$id",
    "$ref",
    "$defs",
    "title",
    "type",
    "const",
    "enum",
    "required",
    "properties",
    "additionalProperties",
    "items",
    "minItems",
    "uniqueItems",
    "minLength",
    "minimum",
    "pattern",
    "oneOf",
  ]);
  const unsupported = Object.keys(schema).find((keyword) => !supportedKeywords.has(keyword));
  if (unsupported) throw new Error(`Unsupported catalog schema keyword: ${unsupported}`);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter((branch) => {
      try {
        validateSchemaValue(value, branch, rootSchema, location);
        return true;
      } catch {
        return false;
      }
    });
    if (matches.length !== 1) throw new Error(`${location}: expected exactly one schema variant`);
  }
  if (schema.$ref) {
    const segments = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
    let resolved = rootSchema;
    for (const segment of segments) resolved = resolved?.[segment];
    if (!resolved) throw new Error(`Unresolvable catalog schema reference: ${schema.$ref}`);
    validateSchemaValue(value, resolved, rootSchema, location);
    return;
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    throw new Error(`${location}: expected constant ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${location}: expected one of ${schema.enum.join(", ")}`);
  }
  const matchesType = {
    object: value !== null && typeof value === "object" && !Array.isArray(value),
    array: Array.isArray(value),
    string: typeof value === "string",
    boolean: typeof value === "boolean",
    number: typeof value === "number" && Number.isFinite(value),
    integer: Number.isInteger(value),
  };
  if (schema.type && !matchesType[schema.type]) {
    throw new Error(`${location}: expected ${schema.type}`);
  }
  if (schema.type === "object") {
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(value, name)) throw new Error(`${location}: missing required ${name}`);
    }
    for (const [name, child] of Object.entries(value)) {
      const propertySchema =
        schema.properties && Object.hasOwn(schema.properties, name)
          ? schema.properties[name]
          : undefined;
      if (propertySchema === undefined) {
        if (schema.additionalProperties === false) {
          throw new Error(`${location}: unexpected property ${name}`);
        }
        continue;
      }
      validateSchemaValue(child, propertySchema, rootSchema, `${location}.${name}`);
    }
  }
  if (schema.type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new Error(`${location}: expected at least ${schema.minItems} items`);
    }
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        throw new Error(`${location}: expected unique items`);
      }
    }
    if (schema.items) {
      value.forEach((item, index) =>
        validateSchemaValue(item, schema.items, rootSchema, `${location}[${index}]`),
      );
    }
  }
  if (schema.type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new Error(`${location}: expected at least ${schema.minLength} characters`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new Error(`${location}: does not match ${schema.pattern}`);
    }
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    throw new Error(`${location}: expected at least ${schema.minimum}`);
  }
}
