// Type-safe FormData parsing utilities

export function getRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

export function getOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function getRequiredNumber(formData: FormData, key: string): number {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing required field: ${key}`);
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`Invalid number for field: ${key}`);
  }
  return num;
}

export function getOptionalNumber(formData: FormData, key: string): number | null {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}
