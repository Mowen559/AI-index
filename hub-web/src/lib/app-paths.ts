import path from "path";

function normalizeEnvPath(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? path.resolve(trimmed) : null;
}

export function getBundleRoot() {
  return (
    normalizeEnvPath(process.env.HUB_BUNDLE_ROOT) ??
    path.resolve(process.cwd(), "..", "..")
  );
}

export function isBundledRuntime() {
  return Boolean(process.env.HUB_BUNDLE_ROOT || process.env.HUB_APP_DATA_ROOT);
}

export function getAppDataRoot() {
  return (
    normalizeEnvPath(process.env.HUB_APP_DATA_ROOT) ??
    path.join(process.cwd(), ".aindex-hub")
  );
}

export function getAppDataPath(...segments: string[]) {
  return path.join(getAppDataRoot(), ...segments);
}
