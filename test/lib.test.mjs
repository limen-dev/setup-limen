import assert from "node:assert/strict";
import { test } from "node:test";

import { input } from "../src/lib/actions.mjs";
import { parseChecksums, parseVersion, targetFor } from "../src/lib/install.mjs";
import { loginArgs } from "../src/lib/login.mjs";

test("targetFor maps the platforms the release builds", () => {
  assert.equal(targetFor("linux", "x64"), "x86_64-unknown-linux-gnu");
  assert.equal(targetFor("linux", "arm64"), "aarch64-unknown-linux-gnu");
  assert.equal(targetFor("darwin", "x64"), "x86_64-apple-darwin");
  assert.equal(targetFor("darwin", "arm64"), "aarch64-apple-darwin");
});

test("targetFor refuses Windows and other architectures", () => {
  assert.throws(() => targetFor("win32", "x64"), /no release for win32\/x64/);
  assert.throws(() => targetFor("linux", "ia32"), /no release/);
});

test("parseVersion takes latest or a tag, with or without the v", () => {
  assert.equal(parseVersion(""), "latest");
  assert.equal(parseVersion(" latest "), "latest");
  assert.equal(parseVersion("0.1.0"), "v0.1.0");
  assert.equal(parseVersion("v0.1.0"), "v0.1.0");
  assert.equal(parseVersion("v0.1.0-rc.1"), "v0.1.0-rc.1");
});

test("parseVersion refuses anything that could change a URL or a path", () => {
  for (const bad of ["v1", "v1.2", "../v1.2.3", "v1.2.3/../x", "v1.2.3 && id", "v1.2.3?x=1", "main", "v1.2.3-"]) {
    assert.throws(() => parseVersion(bad), /is not a release/, bad);
  }
});

test("parseChecksums reads sha256sum output, text and binary mode", () => {
  const a = "a".repeat(64);
  const b = "B".repeat(64);
  const sums = parseChecksums(`${a}  one.tar.gz\n${b} *two.tar.gz\nnot a line\n`);
  assert.equal(sums.get("one.tar.gz"), a);
  assert.equal(sums.get("two.tar.gz"), "b".repeat(64));
  assert.equal(sums.size, 2);
});

test("loginArgs builds the bot login", () => {
  assert.deepEqual(loginArgs({ proxy: "limen.example.com:443" }), [
    "--proxy", "limen.example.com:443", "login", "--bot", "github_actions",
  ]);
  assert.deepEqual(
    loginArgs({ proxy: "[::1]:3443", botName: "deploy-staging", audience: "limen", caFile: "ca.pem" }),
    ["--proxy", "[::1]:3443", "login", "--bot", "github_actions", "--bot-name", "deploy-staging",
      "--audience", "limen", "--ca-file", "ca.pem"],
  );
});

test("loginArgs refuses a proxy or name that could be read as a flag", () => {
  for (const proxy of ["", "limen.example.com", "--help:1", "-x:443", "host:port", "a b:443", "https://h:443"]) {
    assert.throws(() => loginArgs({ proxy }), /not host:port/, proxy);
  }
  assert.throws(() => loginArgs({ proxy: "h:1", botName: "--x" }), /not a bot name/);
  assert.throws(() => loginArgs({ proxy: "h:1", audience: "a b" }), /spaces/);
});

test("input reads the runner's INPUT_ variables", () => {
  const env = { INPUT_PROXY: " h:1 ", "INPUT_BOT-NAME": "x", INPUT_VERIFY_ATTESTATION: "false" };
  assert.equal(input(env, "proxy"), "h:1");
  assert.equal(input(env, "bot-name"), "x");
  assert.equal(input(env, "verify attestation"), "false");
  assert.equal(input(env, "missing"), "");
});
