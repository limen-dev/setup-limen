# Releasing

Versions are `vMAJOR.MINOR.PATCH` tags, plus a moving major tag (`v0`, later `v1`) that users put in `uses:`.

1. `main` is green and the README's **Status** section is true.
2. Run the [smoke workflow](.github/workflows/smoke.yml) by hand against the newest published Limen release. Do not tag if it fails.
3. Tag the commit: `git tag -s v0.1.0 -m v0.1.0 && git push origin v0.1.0`. Create a GitHub release from it (generate the notes).
4. Move the major tag to it: `git tag -fs v0 -m v0 v0.1.0 && git push -f origin v0`. Only the major tag moves; `vX.Y.Z` tags never do, and the repository's tag ruleset protects them.
5. Publish to the Marketplace from the release page, if you want it listed.

A change to the inputs or the behavior that breaks a workflow needs a new major version.
