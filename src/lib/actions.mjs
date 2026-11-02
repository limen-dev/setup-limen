// The few runner features this action uses, with no dependencies: log lines, workflow commands,
// and the GITHUB_ENV / GITHUB_PATH / GITHUB_OUTPUT / GITHUB_STATE files. Every function takes the
// environment, so tests can point it at temporary files.
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { EOL } from "node:os";

const escapeData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

export const info = (message) => process.stdout.write(`${message}${EOL}`);
export const warning = (message) => process.stdout.write(`::warning::${escapeData(message)}${EOL}`);
export const failure = (message) => process.stdout.write(`::error::${escapeData(message)}${EOL}`);

// An input, as the runner passes it: INPUT_<NAME> with spaces turned into underscores.
export function input(env, name) {
  return (env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? "").trim();
}

function fileCommand(env, variable, key, value) {
  const path = env[variable];
  if (!path) return; // not running on a runner (unit tests, a local try-out)
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(path, `${key}<<${delimiter}${EOL}${value}${EOL}${delimiter}${EOL}`);
}

export const setEnv = (env, key, value) => fileCommand(env, "GITHUB_ENV", key, value);
export const setOutput = (env, key, value) => fileCommand(env, "GITHUB_OUTPUT", key, value);
export const saveState = (env, key, value) => fileCommand(env, "GITHUB_STATE", key, value);
export const state = (env, key) => env[`STATE_${key}`] ?? "";

export function addPath(env, directory) {
  if (!env.GITHUB_PATH) return;
  appendFileSync(env.GITHUB_PATH, `${directory}${EOL}`);
}
