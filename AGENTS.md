# Instructions for coding agents

`setup-limen`: a GitHub Action (Node 24, no dependencies, no build step) that installs the Limen CLI and logs a job in as a bot. A thin client of `limen login --bot` ([ADR-0019](https://github.com/limen-dev/limen/blob/main/docs/adr/0019-machine-identities.md)); the server's rules there decide what this action may assume.

## Rules
- **Work in a git worktree:** `git worktree add .claude/worktrees/<topic> -b <branch>`. Never edit the main checkout or switch its branch.
- **No dependencies, no `dist/`.** What is in `src/` is what runs. Don't add an npm package or a bundler.
- **Fail closed.** A missing or wrong checksum, or a failed provenance check, stops the job. Never add a way to skip both.
- **Secrets stay out of logs.** The action never reads the OIDC token or a Limen credential; keep it that way. Pass arguments as a list, never through a shell.
- **Verify before claiming.** Run it before saying it works. Anything checked only against the stub `limen` or the local release server is labelled *unverified*.
- **The CLI is Limen's.** Flags come from `limen login --help` in limen-dev/limen; don't invent options.
- **Pin every action** in workflows to a full commit SHA with a version comment.
- **Commits:** conventional, small, focused, signed. Stage specific files, never `git add -A`. Don't push or tag unless asked. Pull requests as drafts.

## Commands
```sh
mise install
npm test
mise exec -- actionlint
```
