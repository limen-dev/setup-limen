# setup-limen

A GitHub Action that installs the [Limen](https://github.com/limen-dev/limen) CLI and, if you ask, logs the job in as a **bot** with the job's own OIDC token. Nothing is stored: no SSH key, no database password, and no Limen token in your repository secrets. The job gets a short-lived certificate (15 minutes by default, at most an hour), and every session it opens is audited with the repository, workflow, run and commit.

```yaml
permissions:
  id-token: write   # lets the job ask GitHub for its OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: staging
    steps:
      - uses: actions/checkout@v7

      - uses: limen-dev/setup-limen@v0
        with:
          version: v0.1.0                       # pin one
          proxy: limen.example.com:443

      - run: limen ssh web-staging-1 -- ./deploy.sh
```

To only install the CLI (to run `limen policy test` in a pull request, say), leave `proxy` out. That job needs no `id-token` permission.

## Before it works

1. **A published Limen release.** The action downloads the CLI from [limen-dev/limen releases](https://github.com/limen-dev/limen/releases). Until a release is published (v0.1.0-rc.1 is still a draft) there is nothing to download.
2. **A bot in your Limen policy** that matches this job exactly ([bots guide](https://github.com/limen-dev/limen/blob/main/docs/guides/bots.md), [ADR-0019](https://github.com/limen-dev/limen/blob/main/docs/adr/0019-machine-identities.md)):
   ```yaml
   kind: bot
   version: v1
   metadata: { name: deploy-staging }
   spec:
     join:
       method: github_actions
       match: { repository: acme/infra, ref: refs/heads/main, environment: staging }
     roles: [deployer]
     max_ttl: 15m
   ```
3. **A proxy the runner can reach.** GitHub-hosted runners are on the public internet, so the Limen proxy must be reachable from there. If it is private, use a self-hosted runner inside the network.
4. **`permissions: id-token: write`** on the job when you pass `proxy`.

## Inputs

| Input | Default | |
|---|---|---|
| `version` | `latest` | The Limen release to install, such as `v0.1.0`. **Pin one.** `latest` is the newest *stable* release (never a release candidate) and changes under you. |
| `proxy` | | `host:port` of the Limen proxy. Set it to log in; leave it empty to only install. |
| `bot-name` | | Which bot, if more than one rule could match the job's token. |
| `audience` | | The audience to ask GitHub for. Leave it empty for the one your control plane expects. |
| `ca-file` | | A PEM file with the CA to trust, for a deployment with a private CA. |
| `verify-attestation` | `true` | Also check the release's build provenance with `gh attestation verify`. See below. |
| `github-token` | `github.token` | For the GitHub API only (resolving `latest`, verifying provenance). It needs no permissions. |

## Outputs

| Output | |
|---|---|
| `version` | The release installed, such as `v0.1.0`. |
| `path` | The directory with the `limen` binary. It is already on `PATH`. |
| `logged-in` | `true` if the job logged in. |

After a login, `LIMEN_HOME` and `LIMEN_PROXY` are set for the rest of the job, so later steps run `limen ssh`, `limen db connect` and the rest without flags.

## What it does, and what it refuses

- **Verifies before it trusts.** The archive must be listed in the release's `SHA256SUMS` and match it, and (by default) its **build provenance** must verify with `gh attestation verify`, pinned to the `limen-dev/limen` `release.yml` workflow. A missing checksum, a mismatch, or a failed provenance check stops the job. If `gh` is missing the job also stops; set `verify-attestation: false` only on a runner that has no `gh`, and know that you then rely on the checksum alone (which comes from the same release).
- **Puts only `limen` on `PATH`.** The archive also holds the server binaries; they are not exposed.
- **Keeps credentials in a private directory** under `RUNNER_TEMP` (not the runner's home) and, in the post step, runs `limen logout` and deletes it, even if the job failed. This matters on self-hosted runners that outlive the job.
- **Never sees the OIDC token.** The CLI asks the runner for it; this action only passes along the proxy, the bot name and the audience.
- **Refuses odd input.** `version` must be `latest` or a tag, and `proxy` must be `host:port`; neither can smuggle in a path, a URL or a flag.
- **Has no dependencies.** It is plain Node (24) with no `node_modules` and no bundled `dist/`, so what you read in `src/` is what runs.

## Pull requests

A job triggered by a pull request (including from forks) **never matches a bot**, whatever the rule says. This is Limen's rule, not this action's: that job runs code the author chose. Log in from a push to a protected branch or from a job that targets an **environment with required reviewers**.

## Pin the action

A tag can move. For the strongest guarantee, pin the action to a commit:

```yaml
- uses: limen-dev/setup-limen@<full commit SHA> # v0.1.0
```

## Status

- Install, checksum and provenance checks are **verified against the real v0.1.0-rc.1 release** (archive, `SHA256SUMS` and attestation), served from a local server because that release is still a draft.
- The bot login is **unverified against a real GitHub OIDC token and a real control plane**. It runs `limen login --bot github_actions`, which Limen tests against a stand-in issuer only; the tests here use a stub `limen`. The first real run is the [smoke workflow](.github/workflows/smoke.yml) plus a deploy to a test Limen.
- Linux and macOS, on x64 and arm64. There is no Windows build of Limen.

## Develop

```sh
mise install
npm test            # no dependencies to install
mise exec -- actionlint
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [RELEASING.md](RELEASING.md). Report vulnerabilities as in [SECURITY.md](SECURITY.md).

Licensed under the [Apache License 2.0](LICENSE).
