# Restaurant OS MVP

Telegram Mini App MVP for restaurant staff operations. The app combines local shift workflows with a shared Cloudflare Worker API for employees, roles, PIN login, and cross-device access.

## Stack
- React + TypeScript
- Vite
- Tailwind CSS
- Zustand
- Cloudflare Pages for frontend
- Cloudflare Worker + Workers KV for shared employee access

## Features Included
- Shift dashboard with stage progress and gated close action
- Missions flow with employee and owner acceptance states
- Requests flow with local form storage and configurable external links
- Shared PIN access via Worker API and KV
- One-time owner bootstrap across all devices
- Owner employee management: add, edit, reset PIN, archive
- Profile with employee card, logout, time tracking, hourly-rate setup, and privacy-hidden earnings
- Timesheet screen with weekly/monthly shift history and early-start reasons
- Owner team statistics for hours, shifts, early starts, and preliminary earnings
- Handoff screen for kitchen and bar
- Losses screen with operational damage calculation
- Telegram Mini App bootstrap via `telegram-web-app.js`

## Project Structure
- `src/api/client.ts`: frontend API wrapper for Worker endpoints
- `src/config/links.ts`: editable URLs
- `src/data/mock.ts`: local demo seed for shift data
- `src/lib/timeTracking.ts`: shift rules and salary helpers
- `src/store/useAppStore.ts`: Zustand state, local persistence, auth bootstrap
- `src/screens/*`: route-level UI
- `worker/src/index.ts`: Cloudflare Worker API
- `worker/wrangler.toml`: Worker config
- `docs/PRODUCT_SPEC.md`: product behavior and done criteria

## Install
```bash
npm install
```

## Frontend Dev
Run Vite:

```bash
npm run dev
```

If the Worker API is on another origin, set the API base URL:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

Expected result:
- Vite starts on `http://localhost:5173`
- Browser fallback works outside Telegram
- Telegram WebView still calls `tg.ready()` and `tg.expand()`

## Worker Setup
1. Create KV namespace:

```bash
npx wrangler kv namespace create STAFF_KV
```

2. Copy the returned namespace IDs into [worker/wrangler.toml](/Users/rio/Desktop/EtnaStaff/worker/wrangler.toml)
3. Set the origin allowed to call the API:
   - `ALLOWED_ORIGIN = "https://<your-pages-domain>"`
4. Put the session signing secret:

```bash
npx wrangler secret put SESSION_SECRET --config worker/wrangler.toml
```

5. Start the Worker locally:

```bash
npm run worker:dev
```

6. In a second terminal run the frontend against the Worker:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

## Worker Deploy
Deploy the shared access backend:

```bash
npm run worker:deploy
```

After deploy you will get a Worker URL like:
- `https://restaurant-os-api.<account>.workers.dev`

Use that value as `VITE_API_BASE_URL` in Cloudflare Pages.

## Cloudflare Pages Deploy
1. Push the repo to GitHub
2. Create or update the Pages project
3. Use:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node.js version: `20`
4. Add Pages environment variable:
   - `VITE_API_BASE_URL=https://<your-worker>.workers.dev`
5. Deploy

## Build And Checks
```bash
npm run build
npm run lint
npm run typecheck
```

Expected result:
- `dist/` is generated for Cloudflare Pages
- frontend typecheck passes
- Worker code stays separate and does not affect static Pages build

## Access Control Flow
- First device opens the app
- Frontend calls `GET /api/bootstrap/status`
- If not bootstrapped, it shows `Создать PIN основателя`
- Bootstrap calls `POST /api/bootstrap` and creates the only initial owner
- Every next device sees `bootstrapped=true` and goes straight to login
- Login uses:
  - `GET /api/employees` for active public employee list
  - `POST /api/auth/login` for PIN verification
- Frontend stores only the session token locally
- On app start the token is verified through `GET /api/me`

## Managing Employees
- Log in as owner
- Open `Я`
- Open `Сотрудники`
- Available actions:
  - add employee with role and PIN
  - edit role, title, active state
  - reset PIN
  - archive employee without deleting history

## Local Storage
Still local:
- shift demo state
- missions
- requests
- losses
- handoff
- timesheet entries
- session token

No longer local-only:
- employees
- roles
- PIN hashes
- bootstrap owner state
- login authorization

If you need to reset only frontend state:
1. Clear site data for the Pages domain
2. Reload the app

If you need to reset shared employee access:
1. Clear the Worker KV namespace manually
2. Bootstrap owner again

## Timesheet Usage
- Open `Я` to start or end a shift
- Starting before `11:20` requires a reason
- One active shift per employee
- Closing a shift shorter than `15 minutes` requires confirmation
- `Табель` shows week/month entries and early-start reasons
- Salary numbers are still local and marked `≈ Предварительный расчёт`

## Telegram BotFather Setup
1. Deploy Pages and Worker
2. Use the Pages HTTPS URL in BotFather
3. Confirm the Pages build has `VITE_API_BASE_URL` pointed to the deployed Worker
4. Open the Mini App inside Telegram and verify:
   - WebView expands
   - username displays from Telegram
   - PIN login works
   - employee list matches other devices

## E2E Checklist
1. Device A opens the app and sees bootstrap screen
2. Device A creates owner PIN
3. Device B opens the app and immediately sees login, not bootstrap
4. Owner logs in on A and adds a new employee
5. Device B refreshes and sees the new employee in login list
6. New employee logs in on B with assigned PIN
7. Non-owner cannot open employee management
8. Owner can reset employee PIN on A
9. Employee can use the new PIN on B
10. Calling protected endpoints without token returns `401`

## Security Note
This is lightweight protection for staff-only access. It prevents casual access and keeps employee settings shared between devices, but it is not strong identity verification.

Stronger next step:
- whitelist by Telegram `user_id`
- backend validation of Telegram init data
- revocable sessions and audit trail
