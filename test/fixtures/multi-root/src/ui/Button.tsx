import { externalThing } from "@external";

/**
 * Shared button with an external dependency.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask button
 * @catalogConstraint Callers own submit behavior.
 * @catalogExample production src/examples.tsx | Shared button example
 */
export function Button(props: { disabled?: boolean }) {
  void externalThing;
  const broken: number = "not a number";
  return null;
}
