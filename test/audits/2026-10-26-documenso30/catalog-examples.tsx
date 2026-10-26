// Trial-only callers for entries without an existing app usage.
import { ClientOnly } from './client-only';
import { SigningCard } from './signing-card';
import { FieldContainerPortal } from './field/field';

export const catalogExamples = [
  <ClientOnly key="client"><span /></ClientOnly>,
  <SigningCard key="card" name="A" signature="sig" signingCelebrationImage={null} />,
  <FieldContainerPortal key="portal" field={{} as any} />,
];
