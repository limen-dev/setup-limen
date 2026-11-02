# Releasing

Tags are `vMAJOR.MINOR.PATCH`, plus a moving major tag (`v0`) for `uses:`.

1. `main` is green and the README's **Status** is true.
2. Run the [smoke workflow](.github/workflows/smoke.yml) against the newest published Limen release. Don't tag if it fails.
3. `git tag -s v0.1.0 -m v0.1.0 && git push origin v0.1.0`, then create a GitHub release from it. Tick "Publish this Action to the GitHub Marketplace" (needs the owner's account).
4. Move the major tag: `git tag -fs v0 -m v0 v0.1.0 && git push -f origin v0`. Only the major tag moves; `vX.Y.Z` tags are protected.

A change that can break a workflow needs a new major version.
