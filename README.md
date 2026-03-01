# Restaurant OS MVP

Telegram Mini App MVP for restaurant staff operations. The app replaces shift chat chaos with one mobile-first interface for shift progress, missions, requests, losses, and handoff.

## Stack
- React + TypeScript
- Vite
- Tailwind CSS
- Zustand
- Cloudflare Pages static deploy

## Features Included
- Shift dashboard with stage progress and gated close action
- Missions flow with employee and owner acceptance states
- Requests flow with local form storage and configurable external links
- Profile with role switch and weekly neutral metrics
- Handoff screen for kitchen and bar
- Losses screen with operational damage calculation
- Telegram Mini App bootstrap via `telegram-web-app.js`

## Project Structure
- `src/config/links.ts`: all editable URLs in one place
- `src/data/mock.ts`: seed data for a live-looking demo
- `src/store/useAppStore.ts`: local persisted state
- `src/screens/*`: main app screens
- `docs/PRODUCT_SPEC.md`: MVP spec and done criteria

## Local Setup
1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Start local development:

```bash
npm run dev
```

Expected result:
- Vite starts a local server, typically on `http://localhost:5173`.
- In a regular browser the app runs with fallback name `Гость смены`.
- In Telegram WebView the app calls `tg.ready()` and `tg.expand()` and shows the Telegram user display name from `initDataUnsafe.user`.

## Production Build
Run:

```bash
npm run build
```

Expected result:
- TypeScript passes.
- Vite creates a static `dist/` directory for Cloudflare Pages.

Optional checks:

```bash
npm run lint
npm run typecheck
```

## Cloudflare Pages Deploy
1. Push the repository to GitHub.
2. In Cloudflare Pages create a new project from the repo.
3. Use these build settings:
   - Framework preset: `Vite`
   - Node.js version: `20`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy.

No runtime secrets are required for this MVP.

## Cloudflare Pages Via Wrangler
If you prefer CLI deploys:

```bash
npm run build
npx wrangler pages deploy dist
```

Project config is already prepared in:
- `wrangler.toml`

## Pre-Deploy Checklist
- Replace placeholder URLs in `src/config/links.ts`
- Confirm `npm run build` passes locally
- Verify the production output exists in `dist/`
- Deploy to Cloudflare Pages and copy the final HTTPS URL

## Telegram BotFather Setup
1. Deploy the app and copy the public HTTPS URL from Cloudflare Pages.
2. Open BotFather.
3. Configure your bot menu button or Web App button to use the deployed URL.
4. Open the Mini App from Telegram and confirm:
   - the WebView expands,
   - the username appears,
   - the bottom navigation and screens render correctly.

## Configurable Links
Update these placeholders before real use:
- Knowledge base URL
- Task chat URL
- Closing photo checklist URL
- Yandex form URLs for kitchen, bar, and supplies

All are stored in:
- `src/config/links.ts`

## MVP Limits
- No backend
- No secure authentication
- No real file upload
- No Telegram user authorization checks yet

## Next Backend Step
When moving to Supabase later:
- replace Zustand persistence with remote tables,
- map role by Telegram user ID whitelist,
- move request/task acceptance to real multi-user sync,
- add secure verification of Telegram init data on backend.
