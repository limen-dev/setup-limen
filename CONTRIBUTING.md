# Contributing

## Layout

| Path | What |
|---|---|
| `action.yml` | The action's interface: inputs, outputs, and the `main` and `post` entry points (Node 24). |
| `src/main.mjs`, `src/post.mjs` | The entry points. They only call `src/lib/run.mjs` and report errors. |
| `src/lib/run.mjs` | The flow: install, then log in; and the post-step cleanup. |
| `src/lib/install.mjs` | Resolve the release, download, verify (checksum, provenance), unpack, cache. |
| `src/lib/login.mjs` | The `limen login --bot` command line, with input validation. |
| `src/lib/actions.mjs` | Log lines and the runner's `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_OUTPUT`, `GITHUB_STATE` files. |
| `test/` | `node:test` suites. A local server stands in for the release and a stub script for `limen`. |

There is no build step and no `dist/`: the code in `src/` is what runs. Keep it free of dependencies; an action's dependencies run with the job's permissions. If you think one is needed, open an issue first.

## Tests

```sh
mise install && npm test
```

Anything checked only against the stub `limen` or the local release server is **unverified** against a real Limen and real GitHub. Say so in pull requests and in the README.

## Commits and pull requests

Conventional commits, small and focused, signed (the `main` branch requires signatures and linear history). Open pull requests as drafts; CI starts when you mark one ready for review.
