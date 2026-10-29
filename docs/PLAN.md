# Plan

Status legend: [x] done · [~] in progress · [ ] not started

## 1. Scaffold — [x]

- [x] Next.js App Router + React 19 + TypeScript strict
- [x] Tailwind CSS 4, R3F + drei, Zustand
- [x] Vitest (unit) + Playwright (e2e) with a smoke test each
- [x] ESLint (zero warnings) + Prettier
- [x] CLAUDE.md, docs/BRIEF, PLAN, ARCHITECTURE, DECISIONS
- [x] `pnpm check` script + GitHub Actions workflow
- [x] Minimal typed i18n dictionary so components never hold literals

## 2. Vehicle sim + flat test track + chase camera — [ ]

- [ ] `src/game/vehicle`: bicycle model, surfaces, torque curve, 5-speed auto
- [ ] Fixed 120 Hz stepper with render interpolation
- [ ] Keyboard input mapping (pure TS state, DOM listener in component)
- [ ] Flat test track scene + `ChaseCameraRig`
- [ ] Unit tests: top speed per car, braking distance, grip ordering

## 3. Terrain, road, checkpoints, timing, Forest — [ ]

## 4. Cockpit + Isometric cameras, V cycling, reduced motion — [ ]

## 5. HUD, service park, Garage, car models, economy tests — [ ]

## 6. Save system, API route, Game ID URL, start/continue — [ ]

## 7. i18n ES/IT, Settings, quality tiers, post-processing, audio — [ ]

## 8. Regions, weather, night, polish, smoke tests, screenshot script — [ ]

## 9. Capacitor iOS/Android, docs/ANDROID.md — [ ]
