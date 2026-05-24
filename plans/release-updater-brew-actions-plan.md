# Release updater, Homebrew, and GitHub Actions plan

## Decision

`auth-switch` is an Electron app, while `usage-bar` is a native macOS app. True Sparkle runtime integration would require bundling `Sparkle.framework` and maintaining native macOS bridge code, while still needing a separate Windows updater path. The chosen implementation uses `electron-updater` for runtime updates on macOS and Windows, and publishes a Sparkle-compatible `appcast.xml` release asset to mirror the `usage-bar` release metadata flow.

## Scope

1. Add packaged-app update checks through `electron-updater`.
2. Configure `electron-builder` to emit macOS DMG+ZIP and Windows NSIS update metadata.
3. Add GitHub Actions for CI, unsigned artifact builds, and manual release publishing.
4. Generate release notes, `appcast.xml`, and Homebrew cask updates from the manual release workflow.

## Notes

- macOS artifacts are currently unsigned/not notarized unless signing secrets are added later.
- The Electron app consumes `latest-mac.yml` / `latest.yml`; `appcast.xml` is compatibility metadata, not the runtime updater feed.
- Homebrew cask automation targets `SHLE1/homebrew-tap` and requires `HOMEBREW_TAP_GITHUB_TOKEN`.
