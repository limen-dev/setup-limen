import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { install } from "../src/lib/install.mjs";
import { main, post } from "../src/lib/run.mjs";
import { TAG, arch, buildRelease, fakeGh, platform, serve, target, tempDir } from "./helpers.mjs";

const NO_ATTESTATION = { verify: false, token: "", ghBin: "gh" };

async function setup(releaseOptions) {
  const release = await buildRelease(releaseOptions);
  const server = await serve(release);
  const dir = await tempDir("work");
  return { release, server, cacheRoot: join(dir, "cache"), tempRoot: dir, dir };
}

test("install verifies the checksum, keeps only the limen binary, and caches", async () => {
  const { server, cacheRoot, tempRoot } = await setup();
  try {
    const args = { tag: TAG, target, cacheRoot, tempRoot, downloadBase: server.base, attestation: NO_ATTESTATION };
    const first = await install(args);
    assert.equal(first.cached, false);
    await access(first.bin);
    await assert.rejects(access(join(first.dir, "limen-control-plane")), "server binaries must not be exposed");
    const requests = server.requests.length;
    const second = await install(args);
    assert.equal(second.cached, true);
    assert.equal(server.requests.length, requests, "a cached install downloads nothing");
  } finally {
    await server.close();
  }
});

test("install refuses an archive that does not match SHA256SUMS", async () => {
  const { server, cacheRoot, tempRoot } = await setup({ tamper: true });
  try {
    await assert.rejects(
      install({ tag: TAG, target, cacheRoot, tempRoot, downloadBase: server.base, attestation: NO_ATTESTATION }),
      /does not match SHA256SUMS/,
    );
    await assert.rejects(access(join(cacheRoot, "limen", TAG, target, "limen")), "nothing is installed");
  } finally {
    await server.close();
  }
});

test("install refuses an archive that SHA256SUMS does not list", async () => {
  const { server, cacheRoot, tempRoot } = await setup({ listed: false });
  try {
    await assert.rejects(
      install({ tag: TAG, target, cacheRoot, tempRoot, downloadBase: server.base, attestation: NO_ATTESTATION }),
      /not listed in the release's SHA256SUMS/,
    );
  } finally {
    await server.close();
  }
});

test("install fails clearly on a release that does not exist", async () => {
  const { server, cacheRoot, tempRoot } = await setup();
  try {
    await assert.rejects(
      install({ tag: "v9.9.9", target, cacheRoot, tempRoot, downloadBase: server.base, attestation: NO_ATTESTATION }),
      /HTTP 404/,
    );
  } finally {
    await server.close();
  }
});

test("provenance: fails closed without gh, on a failed check, and passes on success", async () => {
  const { server, cacheRoot, tempRoot, dir } = await setup();
  try {
    const base = { tag: TAG, target, tempRoot, downloadBase: server.base };
    const verify = (ghBin, root) => install({ ...base, cacheRoot: root, attestation: { verify: true, token: "t", ghBin } });
    await assert.rejects(verify(join(dir, "no-such-gh"), cacheRoot), /GitHub CLI \(gh\) is not installed/);
    await assert.rejects(verify(await fakeGh(1), cacheRoot), /build provenance .* did not verify[\s\S]*attestation said no/);
    await assert.rejects(access(join(cacheRoot, "limen", TAG, target, "limen")), "nothing is installed after a failure");
    const ok = await verify(await fakeGh(0), cacheRoot);
    assert.equal(ok.cached, false);
  } finally {
    await server.close();
  }
});

function jobEnv(dir, extra = {}) {
  return {
    ...process.env,
    RUNNER_TEMP: dir,
    RUNNER_TOOL_CACHE: join(dir, "cache"),
    GITHUB_ENV: join(dir, "github_env"),
    GITHUB_PATH: join(dir, "github_path"),
    GITHUB_OUTPUT: join(dir, "github_output"),
    GITHUB_STATE: join(dir, "github_state"),
    STUB_LOG: join(dir, "stub.log"),
    INPUT_VERSION: TAG,
    "INPUT_VERIFY-ATTESTATION": "false",
    ...extra,
  };
}

const read = (path) => readFile(path, "utf8").catch(() => "");

test("main with no proxy installs and does not log in", async () => {
  const { server, dir } = await setup();
  try {
    const env = jobEnv(dir);
    await main(env, { platform, arch, downloadBase: server.base });
    assert.match(await read(env.GITHUB_PATH), /limen\/v0\.1\.0\//);
    assert.match(await read(env.GITHUB_OUTPUT), /logged-in<<[^\n]+\nfalse\n/);
    assert.equal(await read(env.STUB_LOG), "", "the binary was not run");
    assert.equal(await read(env.GITHUB_STATE), "");
  } finally {
    await server.close();
  }
});

test("main logs in as a bot with a private LIMEN_HOME, and post removes it", async () => {
  const { server, dir } = await setup();
  try {
    const env = jobEnv(dir, {
      INPUT_PROXY: "limen.example.com:443",
      "INPUT_BOT-NAME": "deploy-staging",
      "INPUT_CA-FILE": "/tmp/ca.pem",
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.invalid/",
    });
    await main(env, { platform, arch, downloadBase: server.base });

    const [login] = (await read(env.STUB_LOG)).trim().split("\n");
    const [home, args] = login.split("|");
    assert.equal(
      args,
      "--proxy limen.example.com:443 login --bot github_actions --bot-name deploy-staging --ca-file /tmp/ca.pem",
    );
    assert.match(home, /limen-home-/);
    await access(home);
    assert.ok((await read(env.GITHUB_ENV)).includes(home), "later steps get the same LIMEN_HOME");
    assert.match(await read(env.GITHUB_ENV), /LIMEN_PROXY<<[^\n]+\nlimen\.example\.com:443\n/);
    assert.match(await read(env.GITHUB_OUTPUT), /logged-in<<[^\n]+\ntrue\n/);

    // The post step gets the state the main step saved.
    const saved = await read(env.GITHUB_STATE);
    const stateEnv = { ...env };
    for (const key of ["bin", "home"]) {
      stateEnv[`STATE_${key}`] = new RegExp(`${key}<<[^\\n]+\\n([^\\n]+)\\n`).exec(saved)[1];
    }
    await post(stateEnv);
    await assert.rejects(access(home), "the credentials directory is gone");
    assert.match((await read(env.STUB_LOG)).trim().split("\n").pop(), /\|logout$/);
  } finally {
    await server.close();
  }
});

test("main reports a refused login and still leaves state for cleanup", async () => {
  const { server, dir } = await setup();
  try {
    const env = jobEnv(dir, {
      INPUT_PROXY: "limen.example.com:443",
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.invalid/",
      STUB_FAIL: "1",
    });
    await assert.rejects(main(env, { platform, arch, downloadBase: server.base }), /limen login failed \(exit 3\)/);
    assert.match(await read(env.GITHUB_STATE), /home<</, "post can still delete the directory");
    assert.doesNotMatch(await read(env.GITHUB_OUTPUT), /logged-in<<[^\n]+\ntrue/);
  } finally {
    await server.close();
  }
});

test("main refuses to log in without id-token permission, before downloading", async () => {
  const { server, dir } = await setup();
  try {
    const env = jobEnv(dir, { INPUT_PROXY: "limen.example.com:443" });
    delete env.ACTIONS_ID_TOKEN_REQUEST_URL;
    await assert.rejects(main(env, { platform, arch, downloadBase: server.base }), /permissions: id-token: write/);
    assert.deepEqual(server.requests, []);
  } finally {
    await server.close();
  }
});

test("post does nothing when the job never logged in", async () => {
  await post({});
});
