# Build resources

Place Windows branding assets here for electron-builder:

| File | Purpose |
|------|---------|
| `icon.ico` | Window / installer icon (optional until smoke-tested release) |

Until an icon is provided, electron-builder uses the Electron default icon. That is acceptable for **dir** dry-runs; branded installers should wait for a real icon **and** a green smoke test (§26 rule 11).
