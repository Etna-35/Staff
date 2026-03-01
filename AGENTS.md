# AGENTS.md

## Project Purpose
Restaurant OS is a Telegram Mini App MVP for restaurant shift operations. Keep the product mobile-first, low-friction, and prepared for later backend integration.

## Stack
- React + TypeScript
- Vite
- Tailwind CSS
- Zustand for mock local state
- Cloudflare Pages static build

## Runbook
- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Build production bundle: `npm run build`
- Lint code: `npm run lint`
- Format code: `npm run format`
- Optional type check: `npm run typecheck`

## Development Rules
- Keep all external URLs configurable in `src/config/links.ts`.
- Do not add secrets, tokens, or service keys to the repository.
- Do not implement real authentication in this stage.
- Prefer extending the existing Zustand store instead of introducing a backend abstraction too early.
- Preserve mobile-first behavior and test layouts at narrow widths first.
- Any backend preparation should stay interface-level only, not real integration.

## Verification Checklist
- `npm run dev` starts without runtime errors.
- `npm run build` generates a static `dist/` bundle.
- Telegram WebApp initializes without breaking browser fallback mode.
- Role switch changes owner-only controls in UI.
- Missions can be created, marked done, accepted, and returned.
- Requests can be saved locally and show configured external links.
- Losses update operational damage calculation.
- Handoff completion affects shift progress.
- Shift close CTA remains disabled until required stages are complete.

## File Conventions
- `src/config/*`: editable configuration
- `src/data/*`: mock seed data
- `src/store/*`: client-side state and persistence
- `src/screens/*`: route-level screens
- `src/components/*`: reusable UI building blocks
- `docs/*`: product and operational documentation

