# Instructions for coding agents

`setup-limen`: a GitHub Action (Node 24, no dependencies, no build step) that installs the Limen CLI and logs a job in as a bot, a thin client of `limen login --bot` ([ADR-0019](https://github.com/limen-dev/limen/blob/main/docs/adr/0019-machine-identities.md)).

## Rules
- **Work in a git worktree:** `git worktree add .claude/worktrees/<topic> -b <branch>`. Never edit the main checkout or switch its branch.
- **No dependencies, no `dist/`.** What is in `src/` is what runs.
- **Fail closed.** A missing or wrong checksum, or a failed provenance check, stops the job. Never add a way to skip both.
- **The action never reads the OIDC token or a Limen credential.** Pass arguments as a list, never through a shell.
- **The CLI is Limen's.** Flags come from `limen login --help`; don't invent options.
- **Verify before claiming.** Anything checked only against the stub `limen` or the local release server is *unverified*.
- **Pin every action** in workflows to a full commit SHA with a version comment.
- **Commits:** conventional, small, signed; stage specific files. Don't push or tag unless asked. Pull requests as drafts.

```sh
mise install && npm test && mise exec -- actionlint
```
