/**
 * Primitive input with no imports outside its root.
 * @componentCatalog
 * @catalogStatus experimental
 * @catalogTask input
 * @catalogConstraint Callers provide a value or defaultValue.
 * @catalogExample production src/examples.tsx | Primitive input example
 */
export function Input(props: { value?: string }) {
  void props;
  return null;
}
