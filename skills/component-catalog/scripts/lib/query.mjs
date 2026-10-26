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

export function search(catalog, input, limit = 5, vocabulary = {}, brief = false, details = false, layer = null, layerFallback = false, perLayer = null) {
  const query = normalize(input);
  const terms = [...new Set(query.split(/\s+/))];
  // CJK queries are often written with spaces between words. Match vocabulary
  // against the compact form as well so "补偿 列表" can trigger "补偿列表".
  const compactQuery = /[\u3400-\u9fff]/.test(query) ? query.replace(/\s+/g, "") : query;
  const matchedTerms = Object.entries(vocabulary)
    .map(([term, values]) => [normalize(term), values])
    .filter(([term]) => includesTerm(query, term) || includesTerm(compactQuery, term));
  // A longer phrase owns a contained term unless that shorter term explicitly
  // relates to the longer phrase's primary. This keeps structural words such
  // as "列表" (related to flight-delay-list) while dropping generic modifiers
  // such as "补偿" inside "补偿列表".
  const concepts = matchedTerms
    .filter(
      ([term, values]) =>
        !matchedTerms.some(
          ([other, otherValues]) =>
            other !== term &&
            other.includes(term) &&
            (otherValues.primary === values.primary ||
              !values.related?.includes(otherValues.primary)),
        ),
    )
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
  const autoLayer = layer === "auto" ? ranked[0]?.item.layer : null;
  const requestedLayer = layer === "auto" ? autoLayer : layer;
  let scoped;
  let scopedLayers = null;
  if (perLayer != null) {
    const byLayer = new Map();
    for (const entry of ranked) {
      const name = entry.item.layer ?? "unspecified";
      const bucket = byLayer.get(name) ?? [];
      if (bucket.length < perLayer) bucket.push(entry);
      byLayer.set(name, bucket);
    }
    scopedLayers = [...byLayer.keys()];
    scoped = [...byLayer.values()].flat();
  } else {
    scoped = requestedLayer == null ? ranked : ranked.filter(({ item }) => item.layer === requestedLayer);
  }
  let usedLayerFallback = false;
  if (layer != null && scoped.length === 0 && layerFallback) {
    scoped = ranked;
    usedLayerFallback = true;
  }
  const items = scoped
    .slice(0, limit)
    .map(({ item: { id, exportName, kind, summary, tasks, status, reuse, importPath, layer, props, constraints, usage } }) => ({
      id,
      exportName,
      kind,
      importPath,
      layer,
      ...(kind === "component"
        ? { requiredProps: props.items.filter(({ required }) => required).map(({ name }) => name) }
        : {}),
      ...(brief ? {} : { summary }),
      ...(details && constraints?.[0]
        ? { constraint: constraints[0].length > 180 ? `${constraints[0].slice(0, 177)}...` : constraints[0] }
        : {}),
      ...(details && usage ? { usage } : {}),
      tasks,
      status,
      reuse: reuse ?? { scope: "unspecified" },
    }));
  const byLimit = scoped.length - items.length;
  const response = {
    schemaVersion: catalog.schemaVersion,
    sourceDigest: catalog.sourceDigest,
    items,
    ...(brief ? { brief: true } : {}),
    ...(details ? { details: true } : {}),
    ...(layer == null ? {} : { layer: requestedLayer ?? layer }),
    ...(autoLayer == null ? {} : { layerSource: "auto" }),
    ...(usedLayerFallback ? { layerFallback: true } : {}),
    ...(perLayer == null ? {} : { perLayer, layers: scopedLayers }),
    // truncated means the response itself lost fields/items to the byte cap.
    // More matching components than --limit is reported separately as byLimit.
    truncated: false,
    omitted: { items: byLimit, byLimit, byBytes: 0 },
  };
  if (details && size(response) > 4096) {
    for (const item of items) delete item.usage;
  }
  if (details && size(response) > 4096) {
    for (const item of items) {
      if (item.constraint && item.constraint.length > 80) item.constraint = `${item.constraint.slice(0, 77)}...`;
    }
  }
  while (size(response) > 4096 && items.length) {
    items.pop();
    response.omitted.items += 1;
    response.omitted.byBytes += 1;
    response.truncated = true;
  }
  return response;
}

function buildDetail(catalog, item, include, propName, from, maxBytes = 16384) {
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
    if (size(response) <= maxBytes) break;
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
      if (size(response) > maxBytes) {
        delete component[compactField];
        component.propsOmitted = {
          total: propIndex.total,
          inheritedTypes: propIndex.inheritedTypes,
        };
      }
      if (size(response) > maxBytes) delete component.propsOmitted;
    }
  }
  // Restore fields that still fit after the larger fields have been removed.
  for (const field of [...response.omitted.fields].reverse()) {
    if (field === "props" && propsDropped) continue;
    component[field] = field === "examples" ? item.examples.slice(0, 2) : item[field];
    const previous = response.omitted.fields;
    response.omitted.fields = previous.filter((name) => name !== field);
    if (size(response) > maxBytes) {
      delete component[field];
      response.omitted.fields = previous;
    }
  }
  if (size(response) > maxBytes)
    throw new Error(
      selectedProp
        ? "Selected prop and required context exceed output limit; inspect the source locally"
        : "Component identity exceeds output limit; inspect the source locally",
    );
  return response;
}

export function get(catalog, id, include, propName, from) {
  const item = catalog.components.find((component) => component.id === id);
  if (!item) throw new Error("Unknown component ID; use search to find an exact ID");
  return buildDetail(catalog, item, include, propName, from);
}

function minimalDetail(item) {
  return {
    id: item.id,
    exportName: item.exportName,
    exportKind: item.exportKind,
    kind: item.kind,
    importPath: item.importPath,
    sourcePath: item.sourcePath,
    layer: item.layer,
    status: item.status,
    documentationStatus: item.documentationStatus,
    tasks: item.tasks,
    reuse: item.reuse ?? { scope: "unspecified" },
    ...(item.importPath === null
      ? { importContext: { kind: "relative", from: null, extension: item.importExtension } }
      : {}),
  };
}

// Batch details deliberately share one output budget. Each entry is compacted
// independently; if entries still do not fit, later entries are dropped and
// counted, never emitted as a misleading partial component.
export function getMany(catalog, ids, include) {
  const seen = new Set();
  const items = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = catalog.components.find((component) => component.id === id);
    if (!item) throw new Error(`Unknown component ID; use search to find an exact ID: ${id}`);
    items.push(item);
  }
  const entries = items.map((item) => {
    try {
      return buildDetail(catalog, item, include, undefined, undefined, 4096);
    } catch {
      try {
        return buildDetail(catalog, item, [], undefined, undefined, 4096);
      } catch {
        return {
          component: minimalDetail(item),
          truncated: true,
          omitted: { fields: ["summary"], examples: 0 },
        };
      }
    }
  });
  const components = entries.map((entry) => entry.component);
  let truncated = entries.some((entry) => entry.truncated);
  const response = {
    schemaVersion: catalog.schemaVersion,
    sourceDigest: catalog.sourceDigest,
    components,
    truncated,
    omitted: { components: 0 },
  };
  while (size(response) > 16384 && components.length) {
    components.pop();
    response.omitted.components += 1;
    truncated = true;
  }
  response.truncated = truncated;
  return response;
}
