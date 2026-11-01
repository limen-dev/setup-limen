# Security

Report vulnerabilities privately through GitHub's [private vulnerability reporting](https://github.com/limen-dev/setup-limen/security/advisories/new), not in an issue. For vulnerabilities in Limen itself, report to [limen-dev/limen](https://github.com/limen-dev/limen/security).

What this action is careful about:
- It runs code it downloaded, so it checks the archive against the release's `SHA256SUMS` and, by default, its build provenance (`gh attestation verify`, pinned to Limen's `release.yml`), and stops on any failure.
- It never sees, logs or stores the job's OIDC token or any Limen credential. The CLI asks the runner for the token itself.
- The login's credentials live in a private directory under `RUNNER_TEMP` and are removed in the post step.
- `version` and `proxy` are validated, and arguments are passed to programs as a list, never through a shell.
- It has no runtime dependencies to compromise.
