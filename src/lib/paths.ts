import path from "node:path";

/** Where archived builds live; a mounted volume in Docker. */
export function dataDir(): string {
  return process.env.CONSOLE_DATA_DIR || path.join(process.cwd(), "data");
}

/** console.config.json; kept beside the data in Docker so it survives image updates. */
export function configFile(): string {
  return process.env.CONSOLE_CONFIG_FILE || path.join(process.cwd(), "console.config.json");
}
