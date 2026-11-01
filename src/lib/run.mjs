import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import { addPath, info, input, saveState, setEnv, setOutput, state, warning } from "./actions.mjs";
import { exec } from "./exec.mjs";
import { install, parseVersion, resolveTag, targetFor } from "./install.mjs";
import { loginArgs } from "./login.mjs";

// `deps` lets tests point the download at a local server and the platform at a known value.
export async function main(env, deps = {}) {
  const platform = deps.platform ?? os.platform();
  const arch = deps.arch ?? os.arch();
  const token = input(env, "github-token");
  const tempRoot = env.RUNNER_TEMP || os.tmpdir();
  const cacheRoot = env.RUNNER_TOOL_CACHE || join(tempRoot, "tool-cache");

  const proxy = input(env, "proxy");
  // Check what the login will need before downloading anything.
  const args = proxy
    ? loginArgs({
        proxy,
        botName: input(env, "bot-name"),
        audience: input(env, "audience"),
        caFile: input(env, "ca-file"),
      })
    : null;
  if (args && !env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    throw new Error(
      "the job cannot ask GitHub for an OIDC token. Add `permissions: id-token: write` to the job " +
        "(and `contents: read` if it checks out code).",
    );
  }

  const target = targetFor(platform, arch);
  const tag = await resolveTag(parseVersion(input(env, "version")), {
    fetchFn: deps.fetchFn,
    token,
    apiBase: deps.apiBase,
  });
  const verify = input(env, "verify-attestation").toLowerCase() !== "false";

  const installed = await install({
    tag,
    target,
    cacheRoot,
    tempRoot,
    fetchFn: deps.fetchFn,
    downloadBase: deps.downloadBase,
    attestation: { verify, token, ghBin: deps.ghBin ?? "gh" },
  });
  info(`Limen ${tag} ${installed.cached ? "from the tool cache" : "installed"}: ${installed.bin}`);
  addPath(env, installed.dir);
  setOutput(env, "version", tag);
  setOutput(env, "path", installed.dir);
  setOutput(env, "logged-in", "false");
  if (!args) return;

  // Credentials go in a private directory that the post step deletes, not the runner's home.
  await mkdir(tempRoot, { recursive: true });
  const home = await mkdtemp(join(tempRoot, "limen-home-"));
  saveState(env, "bin", installed.bin);
  saveState(env, "home", home);
  const loginEnv = { ...env, LIMEN_HOME: home };
  const result = await exec(installed.bin, args, { env: loginEnv, stream: true });
  if (result.code !== 0) throw new Error(`limen login failed (exit ${result.code}); see the output above.`);

  setEnv(env, "LIMEN_HOME", home);
  setEnv(env, "LIMEN_PROXY", proxy);
  setOutput(env, "logged-in", "true");
  info("Logged in. The credentials are short-lived and are deleted when the job ends.");
}

// The post step: log out, then delete the credentials directory, even if the job failed.
export async function post(env) {
  const home = state(env, "home");
  if (!home) return;
  const bin = state(env, "bin");
  try {
    const result = await exec(bin, ["logout"], { env: { ...env, LIMEN_HOME: home } });
    if (result.code !== 0) warning(`limen logout exited ${result.code}; deleting the credentials anyway`);
  } catch (error) {
    warning(`limen logout failed (${error.message}); deleting the credentials anyway`);
  }
  await rm(home, { recursive: true, force: true });
}
