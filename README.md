# setup-limen

A GitHub Action that installs the [Limen](https://github.com/limen-dev/limen) CLI and, if you ask, logs the job in as a **bot** with its own OIDC token. No SSH key, database password or Limen token is stored in your secrets. The job gets a certificate that lasts 15 minutes by default (an hour at most), and every session is audited with the repository, workflow, run and commit.

```yaml
permissions:
  id-token: write   # lets the job ask GitHub for its OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-24.04
    environment: staging
    steps:
      - uses: limen-dev/setup-limen@v0
        with:
          version: v0.1.0                # pin one
          proxy: limen.example.com:443  # leave out to only install
      - run: limen ssh web-staging-1 -- ./deploy.sh
```

## You need

- **A published Limen release.** The action downloads the CLI from [limen-dev/limen releases](https://github.com/limen-dev/limen/releases).
- **A bot in your policy** that matches the job exactly ([bots guide](https://github.com/limen-dev/limen/blob/main/docs/guides/bots.md)): `method: github_actions`, with `repository`, and `ref` or `environment`.
- **A proxy the runner can reach.** GitHub-hosted runners are on the public internet; for a private proxy use a self-hosted runner.
- **`id-token: write`** on the job, when you pass `proxy`.

## Inputs and outputs

| Input | Default | |
|---|---|---|
| `version` | `latest` | Release to install, such as `v0.1.0`. **Pin one**: `latest` is the newest stable release and changes under you. |
| `proxy` | | `host:port` of the Limen proxy. Set it to log in. |
| `bot-name` | | Which bot, if more than one could match. |
| `audience` | | Audience to ask GitHub for. Empty uses the one your control plane expects. |
| `ca-file` | | PEM file with the CA to trust, for a private CA. |
| `verify-attestation` | `true` | Also verify build provenance with `gh attestation verify`. |
| `github-token` | `github.token` | For the GitHub API only. Needs no permissions. |

Outputs: `version`, `path` (the directory with `limen`, already on `PATH`) and `logged-in`. After a login, `LIMEN_HOME` and `LIMEN_PROXY` are set for later steps.

## What it does

- **Verifies, then trusts.** The archive must match the release's `SHA256SUMS` and, by default, its provenance must verify against Limen's `release.yml`. Any failure, or a missing `gh`, stops the job. Turn provenance off only on a runner without `gh`; you then rely on the checksum alone.
- **Exposes only `limen`** on `PATH`, not the server binaries in the same archive.
- **Cleans up.** Credentials live in a private directory under `RUNNER_TEMP`; the post step runs `limen logout` and deletes it, even after a failure.
- **Never sees the OIDC token.** The CLI asks the runner for it.
- **Runs what you read.** Plain Node 24, no dependencies, no `dist/`. `version` and `proxy` are validated.

Pull request jobs (including forks) **never match a bot**: Limen refuses them, because that job runs code the author chose. Log in from a protected branch or an environment with required reviewers. To be safest, pin the action to a full commit SHA.

## Status

- **Verified:** install, checksum and provenance against the real v0.1.0-rc.1 release (served locally, as it is still a draft); unit tests with a stub `limen`.
- **Unverified:** the bot login against a real GitHub token and control plane. Run the [smoke workflow](.github/workflows/smoke.yml) and a real login before the first release.
- Linux and macOS, x64 and arm64. Limen has no Windows build.

Develop with `mise install && npm test`. Licensed under [Apache-2.0](LICENSE).
