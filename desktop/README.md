# Micro Rally desktop

A native window for macOS and Windows around the production game at
<https://micro-rally.luigiht.com/game>. Electron, no local copy of the game:
every launch plays the latest deploy, and saves live in the app's own browser
storage (`~/Library/Application Support/Micro Rally` on macOS,
`%APPDATA%\Micro Rally` on Windows). Links off the site open in the default
browser. F11 or Ctrl/Cmd+Shift+F toggles full screen.

## Build

```sh
cd desktop
npm install
npm run dist:mac   # dist/Micro Rally-<v>-universal.dmg and -mac.zip (Apple silicon + Intel)
npm run dist:win   # dist/Micro-Rally-Setup-<v>.exe (x64 + arm64) and Micro-Rally-<v>-portable.exe (x64)
```

Both build on a Mac; the Windows icon and version info are written without
Wine. Run `npm start` to try it unpackaged. Inside VS Code's terminal, unset
`ELECTRON_RUN_AS_NODE` first or Electron starts as plain Node.

## Icons

`build/` holds icons made from `src/app/icon0.svg`:

- `MicroRally.icon`: the Icon Composer source for macOS 26. A 1024 × 1024
  canvas with the green-to-tan gradient as its fill and the M and R as
  full-bleed SVG layers; the system applies the rounded mask, glass and
  shadow. Open it in Icon Composer to tweak it. To ship it, install Xcode 26
  and set `build.mac.icon` to `build/MicroRally.icon` (electron-builder
  compiles it with `actool`).
- `icon.icns`: what builds use today. Drawn on Apple's macOS grid: an
  824 × 824 rounded square (corner radius 185) centred on the 1024 canvas,
  with the artwork filling all of it, so it is the same size as every other
  Dock icon and macOS 26 does not put it in a grey frame.
- `icon.ico` (Windows, 16–256 px) and `icon.png` (window icon).

Regenerate them with `rsvg-convert` and `iconutil` / `magick` if the logo
changes.

## Signing

There is no Apple Developer ID or Windows certificate yet. The Mac app is
ad-hoc signed: on another Mac, open it once with right-click → Open (or
System Settings → Privacy & Security → Open Anyway). Windows SmartScreen
shows "More info → Run anyway" for the unsigned installer.
