export function nowIso() {
  return new Date().toISOString();
}

export function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? unique(value.filter((item): item is string => typeof item === "string"))
    : [];
}

export function includesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}
