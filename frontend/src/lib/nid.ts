/** Normalize NID to digits only (spaces/dashes stripped). */
export function normalizeNid(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits || undefined;
}
