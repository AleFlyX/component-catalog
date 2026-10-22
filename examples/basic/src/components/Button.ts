type ButtonProps = {
  /** Text displayed by the button. */
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

/**
 * A minimal button API for the catalog example; no browser runtime required.
 * @componentCatalog
 * @catalogStatus stable
 * @catalogTask button
 * @catalogConstraint Supply a short, actionable label.
 * @catalogExample preview src/previews/button.ts | Basic button configuration
 */
export function Button({ label, disabled = false }: ButtonProps) {
  return { label, disabled };
}
