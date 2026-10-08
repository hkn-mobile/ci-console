/**
 * App configuration lives in repository variables (plain values) and secrets
 * (keys) whose names start with CFG_. ci-templates writes them, prefix
 * stripped, to config/app.json and builds with --dart-define-from-file, so the
 * app reads each one with String.fromEnvironment('KEY').
 */
export const CONFIG_PREFIX = "CFG_";

/** Key as the app sees it, without the CFG_ prefix. */
export const CONFIG_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,95}$/;

/** GitHub's limit for a single variable value. */
export const MAX_VARIABLE_BYTES = 48 * 1024;

export type ConfigEntry = {
  key: string;
  secret: boolean;
  /** Only variables can be read back; secrets stay write-only. */
  value?: string;
  updatedAt: string;
};
