// Find, download, verify, and unpack a Limen CLI release. Fails closed: a missing checksum, a
// checksum that doesn't match, or a failed provenance check stops the job before anything runs.
import { createHash } from "node:crypto";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { exec } from "./exec.mjs";

export const REPO = "limen-dev/limen";
export const SIGNER_WORKFLOW = `${REPO}/.github/workflows/release.yml`;
const DOWNLOAD_BASE = `https://github.com/${REPO}/releases/download`;
const API_BASE = "https://api.github.com";

// The release builds these four. There is no Windows build.
const TARGETS = {
  "linux/x64": "x86_64-unknown-linux-gnu",
  "linux/arm64": "aarch64-unknown-linux-gnu",
  "darwin/x64": "x86_64-apple-darwin",
  "darwin/arm64": "aarch64-apple-darwin",
};

export function targetFor(platform, arch) {
  const target = TARGETS[`${platform}/${arch}`];
  if (!target) {
    throw new Error(
      `Limen has no release for ${platform}/${arch}. It builds for Linux and macOS, on x64 and arm64.`,
    );
  }
  return target;
}

// "latest", or a tag such as v0.1.0 or v0.2.0-rc.1. A leading "v" is optional. The text becomes
// part of a URL and a path, so anything else is refused.
export function parseVersion(text) {
  const value = text.trim() || "latest";
  if (value === "latest") return "latest";
  const match = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?)$/.exec(value);
  if (!match) {
    throw new Error(`version "${value}" is not a release. Use latest or a tag such as v0.1.0.`);
  }
  return `v${match[1]}`;
}

export async function resolveTag(version, { fetchFn = fetch, token = "", apiBase = API_BASE } = {}) {
  if (version !== "latest") return version;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "setup-limen" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetchFn(`${apiBase}/repos/${REPO}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `could not find the latest Limen release (HTTP ${response.status}). ` +
        "There may be no stable release yet; pin one, for example version: v0.1.0-rc.1.",
    );
  }
  const { tag_name: tag } = await response.json();
  return parseVersion(String(tag));
}

// SHA256SUMS is `sha256sum` output: "<hex>  <file>" per line (a "*" before the name marks binary mode).
export function parseChecksums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line);
    if (match) sums.set(match[2], match[1].toLowerCase());
  }
  return sums;
}

const sha256 = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");

async function download(fetchFn, url, path) {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`could not download ${url} (HTTP ${response.status})`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

const exists = (path) => access(path).then(() => true, () => false);

// Returns { dir, bin, cached }. `dir` holds only the `limen` binary, so putting it on PATH does
// not also expose the server binaries that ship in the same archive.
export async function install({
  tag,
  target,
  cacheRoot,
  tempRoot,
  fetchFn = fetch,
  downloadBase = DOWNLOAD_BASE,
  attestation = { verify: true, token: "", ghBin: "gh" },
}) {
  const dir = join(cacheRoot, "limen", tag, target);
  const bin = join(dir, "limen");
  if (await exists(bin)) return { dir, bin, cached: true };

  const name = `limen-${tag}-${target}`;
  const archive = `${name}.tar.gz`;
  const work = await mkdtemp(join(tempRoot, "setup-limen-"));
  try {
    await download(fetchFn, `${downloadBase}/${tag}/SHA256SUMS`, join(work, "SHA256SUMS"));
    const expected = parseChecksums(await readFile(join(work, "SHA256SUMS"), "utf8")).get(archive);
    if (!expected) throw new Error(`${archive} is not listed in the release's SHA256SUMS`);

    await download(fetchFn, `${downloadBase}/${tag}/${archive}`, join(work, archive));
    const actual = await sha256(join(work, archive));
    if (actual !== expected) {
      throw new Error(`${archive} does not match SHA256SUMS (expected ${expected}, got ${actual})`);
    }

    if (attestation.verify) await verifyProvenance(join(work, archive), attestation);

    const tar = await exec("tar", ["-xzf", join(work, archive), "-C", work]);
    if (tar.code !== 0) throw new Error(`could not unpack ${archive}: ${tar.stderr.trim()}`);
    const unpacked = join(work, name, "limen");
    if (!(await exists(unpacked))) throw new Error(`${archive} has no ${name}/limen`);

    // Land in the cache whole or not at all: a half-copied binary must never look installed.
    await mkdir(dir, { recursive: true });
    const partial = join(dir, `limen.partial-${process.pid}`);
    await copyFile(unpacked, partial);
    await chmod(partial, 0o755);
    await rename(partial, bin);
    return { dir, bin, cached: false };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function verifyProvenance(file, { token, ghBin }) {
  let result;
  try {
    result = await exec(
      ghBin,
      ["attestation", "verify", file, "--repo", REPO, "--signer-workflow", SIGNER_WORKFLOW],
      { env: { ...process.env, GH_TOKEN: token } },
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "verify-attestation is on but the GitHub CLI (gh) is not installed on this runner. " +
          "Install gh, or set verify-attestation: false to rely on the checksum alone.",
      );
    }
    throw error;
  }
  if (result.code !== 0) {
    throw new Error(
      `the build provenance of ${file.split("/").pop()} did not verify:\n${(result.stderr || result.stdout).trim()}`,
    );
  }
}
