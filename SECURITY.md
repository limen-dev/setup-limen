# Security

Report vulnerabilities privately through [GitHub's private reporting](https://github.com/limen-dev/setup-limen/security/advisories/new), not in an issue. For Limen itself, report to [limen-dev/limen](https://github.com/limen-dev/limen/security).

This action runs code it downloads, so it verifies the archive against the release's `SHA256SUMS` and its build provenance, and stops on any failure. It never sees the job's OIDC token, keeps credentials in a private directory that the post step deletes, validates its inputs, and has no runtime dependencies.
