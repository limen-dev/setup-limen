// A fake release server: serves SHA256SUMS and an archive holding a stub `limen` shell script.
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import { join } from "node:path";

import { exec } from "../src/lib/exec.mjs";
import { targetFor } from "../src/lib/install.mjs";

export const TAG = "v0.1.0";
export const platform = os.platform();
export const arch = os.arch();
export const target = targetFor(platform, arch);

export const tempDir = (label) => mkdtemp(join(os.tmpdir(), `setup-limen-test-${label}-`));

// The stub records "<LIMEN_HOME>|<arguments>" per call in $STUB_LOG; STUB_FAIL=1 makes `login` fail.
const STUB = `#!/bin/sh
echo "$LIMEN_HOME|$*" >> "$STUB_LOG"
case "$1" in
  --version) echo "limen 0.1.0 (stub)" ;;
  --proxy) [ "$STUB_FAIL" = 1 ] && { echo "refused" >&2; exit 3; }; echo "ok" ;;
esac
exit 0
`;

export async function buildRelease({ tag = TAG, listed = true, tamper = false } = {}) {
  const dir = await tempDir("release");
  const name = `limen-${tag}-${target}`;
  await mkdir(join(dir, name), { recursive: true });
  await writeFile(join(dir, name, "limen"), STUB);
  await chmod(join(dir, name, "limen"), 0o755);
  await writeFile(join(dir, name, "limen-control-plane"), "#!/bin/sh\nexit 0\n");
  const archive = join(dir, `${name}.tar.gz`);
  const tar = await exec("tar", ["-C", dir, "-czf", archive, name]);
  if (tar.code !== 0) throw new Error(tar.stderr);
  const bytes = await readFile(archive);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const sums = `${listed ? `${hash}  ${name}.tar.gz\n` : ""}${"0".repeat(64)}  other.json\n`;
  // `tamper` serves different bytes than the ones the checksum was taken from.
  const served = tamper ? Buffer.concat([bytes, Buffer.from("x")]) : bytes;
  return { tag, name, sums, served };
}

export async function serve(release) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    if (req.url === `/${release.tag}/SHA256SUMS`) return res.end(release.sums);
    if (req.url === `/${release.tag}/${release.name}.tar.gz`) return res.end(release.served);
    res.statusCode = 404;
    res.end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function fakeGh(exitCode) {
  const dir = await tempDir("gh");
  const path = join(dir, "gh");
  await writeFile(path, `#!/bin/sh\necho "attestation said no" >&2\nexit ${exitCode}\n`);
  await chmod(path, 0o755);
  return path;
}
