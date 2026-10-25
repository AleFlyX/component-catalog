import { callerPath, relativeImport } from "./imports.mjs";

const encode = (value) => JSON.stringify(value) + "\n";
const size = (value) => Buffer.byteLength(encode(value), "utf8");
const normalize = (value) => value.normalize("NFKC").toLowerCase();
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
// ASCII vocabulary terms must not match inside another identifier ("loading" in
// "isLoading"); CJK terms keep substring matching because they have no word
// boundaries. This affects vocabulary concept matching only, not direct terms.
const asciiTerm = (term) => /^[\x00-\x7F]+$/.test(term);
function includesTerm(text, term) {
  if (!asciiTerm(term)) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

export function search(catalog, input, limit = 5, vocabulary = {}) {
  const query = normalize(input);
  const terms = [...new Set(query.split(/\s+/))];
  const matchedTerms = Object.entries(vocabulary)
    .map(([term, values]) => [normalize(term), values])
    .filter(([term]) => includesTerm(query, term));
  // A specific phrase owns its contained terms; unrelated concepts still combine.
  const concepts = matchedTerms
    .filter(([term]) => !matchedTerms.some(([other]) => other !== term && other.includes(term)))
    .map(([, values]) => values);
  const ranked = catalog.components
    .map((item) => {
      const id = normalize(item.id);
      const name = normalize(item.exportName);
      const tasks = item.tasks.map(normalize);
      const summary = normalize(item.summary);
      const apiNames = (item.kind === "namespace" ? item.members : item.props.items).map(
        ({ name }) => normalize(name),
      );
      const taskMatches =
        concepts.filter(({ primary, related }) =>
          tasks.some((task) => task === primary || related.includes(task)),
        ).length + terms.filter((term) => tasks.some((task) => task.includes(term))).length;
      let rank = 0;
      if (query === id || query === name) rank = 6;
      else if (taskMatches) rank = 5;
      else if (terms.some((term) => id.includes(term) || name.includes(term))) rank = 4;
      else if (terms.some((term) => summary.includes(term))) rank = 3;
      else if (apiNames.includes(query)) rank = 2;
      else if (apiNames.some((name) => terms.some((term) => name.includes(term)))) rank = 1;
      const primaryMatches =
        concepts.filter(({ primary }) => tasks[0] === primary).length +
        terms.filter((term) => tasks[0].includes(term)).length;
      const relatedMatches = concepts.filter(({ related }) => related.includes(tasks[0])).length;
      return { item, rank, taskMatches, primaryMatches, relatedMatches };
    })
    .filter(({ rank }) => rank > 0)
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.taskMatches - a.taskMatches ||
        b.primaryMatches - a.primaryMatches ||
        b.relatedMatches - a.relatedMatches ||
        Number(b.item.status === "stable") - Number(a.item.status === "stable") ||
        compare(a.item.id, b.item.id),
    );
  const items = ranked
    .slice(0, limit)
    .map(({ item: { id, exportName, kind, summary, tasks, status, reuse, importPath, props } }) => ({
      id,
      exportName,
      kind,
      importPath,
      ...(kind === "component"
        ? { requiredProps: props.items.filter(({ required }) => required).map(({ name }) => name) }
        : {}),
      summary,
      tasks,
      status,
      reuse: reuse ?? { scope: "unspecified" },
    }));
  const response = {
    schemaVersion: catalog.schemaVersion,
    sourceDigest: catalog.sourceDigest,
    items,
    truncated: false,
    omitted: { items: ranked.length - items.length },
  };
  response.truncated = response.omitted.items > 0;
  while (size(response) > 4096 && items.length) {
    items.pop();
    response.omitted.items += 1;
    response.truncated = true;
  }
  return response;
}

export function get(catalog, id, include, propName, from) {
  const item = catalog.components.find((component) => component.id === id);
  if (!item) throw new Error("Unknown component ID; use search to find an exact ID");
  let selectedProp;
  if (propName !== undefined) {
    if (item.kind !== "component")
      throw new Error("--prop requires a component; use --include members for a namespace");
    selectedProp = item.props.items.find(({ name }) => name === propName);
    if (!selectedProp)
      throw new Error(
        "Unknown catalog prop; names are exact and inherited APIs may require source inspection",
      );
    include = ["constraints"];
  }
  const propsRequested = include?.includes("props") ?? false;
  include ??= [item.kind === "namespace" ? "members" : "props", "constraints", "examples"];
  const component = Object.fromEntries(
    [
      "id",
      "exportName",
      "exportKind",
      "kind",
      "importPath",
      "sourcePath",
      "layer",
      "status",
      "documentationStatus",
      "summary",
      "tasks",
    ].map((key) => [key, item[key]]),
  );
  if (item.replacement) component.replacement = item.replacement;
  component.reuse = item.reuse ?? { scope: "unspecified" };
  if (item.deprecationReason) component.deprecationReason = item.deprecationReason;
  if (from !== undefined) from = callerPath(from);
  if (item.importPath === null) {
    component.importContext = { kind: "relative", from: from ?? null, extension: item.importExtension };
    if (from !== undefined) {
      const relative = relativeImport(item.sourcePath, from, item.importExtension);
      component.importPath = relative.specifier;
    }
  }
  for (const field of include) {
    if (Object.hasOwn(item, field))
      component[field] = field === "examples" ? item.examples.slice(0, 2) : item[field];
  }
  if (selectedProp) {
    const { displayType, typeParameters, inheritedTypes } = item.props;
    component.prop = selectedProp;
    component.propsContext = { displayType, typeParameters, inheritedTypes };
  }
  const omittedExamples = include.includes("examples") ? Math.max(0, item.examples.length - 2) : 0;
  const response = {
    schemaVersion: catalog.schemaVersion,
    sourceDigest: catalog.sourceDigest,
    component,
    ...(selectedProp ? { selection: { kind: "prop", name: propName, partial: true } } : {}),
    truncated: omittedExamples > 0,
    omitted: { fields: [], examples: omittedExamples },
  };
  // Components that inherit DOM attributes can have hundreds of props. Keep a
  // compact name/required index when the full props block cannot fit, instead of
  // returning an entry with no API surface at all.
  const propIndex =
    item.kind === "component" && include.includes("props")
      ? {
          total: item.props.items.length,
          inheritedTypes: item.props.inheritedTypes,
          names: item.props.items.map(({ name }) => name),
          required: item.props.items.filter(({ required }) => required).map(({ name }) => name),
        }
      : undefined;
  let propsDropped = false;
  // Focused queries must keep the selected API, its type context and constraints together.
  const removable = selectedProp
    ? ["tasks", "summary"]
    : ["usage", "examples", "props", "members", "constraints", "tasks", "summary"];
  for (const field of removable) {
    if (size(response) <= 16384) break;
    if (!Object.hasOwn(component, field)) continue;
    delete component[field];
    response.omitted.fields.push(field);
    response.truncated = true;
    if (field === "props" && propIndex) {
      propsDropped = true;
      const compact = propsRequested
        ? propIndex
        : {
            total: propIndex.total,
            inheritedTypes: propIndex.inheritedTypes,
            hint: "use --include props for a bounded prop name index, or --prop for one prop",
          };
      const compactField = propsRequested ? "propIndex" : "propsSummary";
      component[compactField] = compact;
      if (size(response) > 16384) {
        delete component[compactField];
        component.propsOmitted = {
          total: propIndex.total,
          inheritedTypes: propIndex.inheritedTypes,
        };
      }
      if (size(response) > 16384) delete component.propsOmitted;
    }
  }
  // Restore fields that still fit after the larger fields have been removed.
  for (const field of [...response.omitted.fields].reverse()) {
    if (field === "props" && propsDropped) continue;
    component[field] = field === "examples" ? item.examples.slice(0, 2) : item[field];
    const previous = response.omitted.fields;
    response.omitted.fields = previous.filter((name) => name !== field);
    if (size(response) > 16384) {
      delete component[field];
      response.omitted.fields = previous;
    }
  }
  if (size(response) > 16384)
    throw new Error(
      selectedProp
        ? "Selected prop and required context exceed output limit; inspect the source locally"
        : "Component identity exceeds output limit; inspect the source locally",
    );
  return response;
}
