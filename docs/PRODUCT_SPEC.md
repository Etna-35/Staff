# Restaurant OS MVP

## Product Goal
Restaurant OS is a Telegram Mini App for restaurant staff that replaces scattered chats, pinned links, and forms with one mobile-first shift workspace. The MVP now uses a shared Cloudflare Worker + Workers KV for employee access so owner changes work across devices.

## Users and Roles
- `waiter`
- `bartender`
- `chef`
- `owner`

Rules:
- `owner` can manage employees, PINs, and owner statistics.
- Non-owner roles only access staff screens and their own timesheet data.

## MVP Scope
Bottom navigation:
- `Смена`
- `Миссии`
- `Заявки`
- `Я`

Internal flow from `Смена`:
- `Остатки`
- `Потери`
- `Передача`
- `Фото закрытия`
- `Закрытие смены`

Additional internal screens:
- `Передача`
- `Потери`
- `Фото закрытия` as modal / placeholder in MVP
- `Табель`
- `PIN access`
- `Сотрудники`

## UX Principles
- Mobile-first for iPhone and Telegram WebView.
- Large touch targets.
- Minimal text input.
- Calm gamification, no childish visuals.
- Progress and completion states are always more important than dense tables.

## Data Entities

### Task
- `id: string`
- `title: string`
- `assignee: string`
- `points: number`
- `status: assigned | done | accepted | returned`
- `dueLabel: string`
- `completedAt?: string`
- `acceptedAt?: string`
- `returnReason?: string`

Rules:
- Employee can move `assigned` or `returned` to `done`.
- Owner/Admin can move `done` to `accepted` or `returned`.
- Points count only when status becomes `accepted`.

### Shift
- `id: string`
- `startedAt: string`
- `dayLabel: string`
- `leftoversChecked: boolean`
- `closingPhotosChecked: boolean`
- `closedAt?: string`

Rules:
- Shift progress is derived from required stages.
- `Закрыть смену` becomes active only when all stages are complete.

### Losses
- `spoilage: number`
- `staffMeal: number`
- `rd: number`
- `updatedAt?: string`

Rules:
- Operational damage is calculated as `(spoilage + staffMeal) * 1.2`.
- `rd` is tracked separately and does not count into negative ranking metrics.

### Handoff
- `id: string`
- `area: kitchen | bar`
- `title: string`
- `criticality: high | medium | low`
- `checked: boolean`
- `reason: string`

Rules:
- Two tabs/groups: kitchen prep for morning and bar handoff.
- Checkbox should only be meaningful with a filled reason/comment.
- Completion of all handoff items contributes to shift progress.

### Request
- `id: string`
- `category: kitchen | bar | supplies`
- `item: string`
- `remaining: string`
- `needed: string`
- `comment: string`
- `createdAt: string`

Rules:
- In MVP requests are still stored locally.
- External Yandex Forms URLs are configurable in one central file.

### Employee
- `id: string`
- `fullName: string`
- `role: waiter | bartender | chef | owner`
- `positionTitle: string`
- `isActive: boolean`
- `createdAt: ISO`
- `updatedAt: ISO`
- `department: kitchen | bar | hall | other`
- `hourlyRate: number | null`
- `tenureLabel?: string`
- `hasPin: boolean`

Worker-only fields:
- `pinSalt: string`
- `pinHash: string`

Rules:
- Waiters use preset rate `190 ₽/hour`.
- Bartenders use preset rate `270 ₽/hour`.
- Chefs can edit their own rate in profile.
- Owner can create, edit, reset PIN, and archive.
- Hashing is server-side in Worker using `sha-256(pin + global salt + employee salt)`.

### TimeEntry
- `id: string`
- `userId: string`
- `role: waiter | bartender | chef | owner`
- `startAt: string`
- `endAt: string | null`
- `earlyStart: boolean`
- `earlyReason: string | null`
- `createdAt: string`

Rules:
- Normal shift start is `11:20` local device time.
- Normal shift end reference is `23:20`.
- Starting before `11:20` requires explicit reason.
- Only one active shift is allowed per employee.
- Closing a shift shorter than `15 minutes` requires confirmation.

### Session
Frontend:
- `token: string | null`
- `employeeId: string | null`
- `employee: Employee | null`
- `lastAuthAt: string | null`
- `isAuthenticated: boolean`
- `isBootstrapped: boolean | null`

Worker token payload:
- `employeeId`
- `role`
- `iat`
- `exp`

Rules:
- Token is returned by Worker after bootstrap/login.
- Token is signed with `HMAC-SHA256(base64(payload), SESSION_SECRET)`.
- Protected endpoints require `Authorization: Bearer <token>`.

## Access Control (PIN)
- Access is shared across devices through Worker + KV.
- App does not show internal UI until auth state is resolved.
- `GET /api/bootstrap/status` decides whether to show bootstrap or login.
- Bootstrap is global:
  - first successful `POST /api/bootstrap` creates the only initial owner
  - next devices receive `409 already bootstrapped`
- Login flow:
  - fetch active employee list from Worker
  - choose employee
  - enter PIN
  - Worker compares hash and returns signed token
- Frontend stores only session token locally.
- This is lightweight staff access, not strong identity verification.

## Owner Staff Management
- Owner can:
  - add employee
  - edit role / position / active state
  - reset PIN
  - archive employee instead of deleting
- Archived employees stay in history and time records.
- Employee CRUD is centralized in KV and immediately visible on other devices.

## Timesheet And Salary
- Profile includes a timesheet block with start/end actions and weekly/monthly hours.
- Earnings are estimated as `hours * hourly rate`.
- Minutes count proportionally.
- Salary and today's earnings are hidden by default and temporarily revealed by an eye toggle.
- Salary uses privacy UX only; it is not treated as secure data protection.
- A visible note always states: `≈ Предварительный расчёт`.

## Owner Statistics
- Owner sees team aggregates for `today / week / month`.
- Owner can filter statistics by department, employee, and period.
- Staff rows show shifts count, hours, early starts count, and preliminary amount.
- Aggregates are sorted by worked hours descending.

## API Surface
Public:
- `GET /api/health`
- `GET /api/bootstrap/status`
- `GET /api/employees` returns active public employee list when no owner token is present

Auth:
- `POST /api/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `PATCH /api/me`

Owner-only:
- `GET /api/employees?includeArchived=1`
- `POST /api/employees`
- `PATCH /api/employees/:id`
- `POST /api/employees/:id/reset-pin`
- `DELETE /api/employees/:id`

## Storage Strategy
Shared backend:
- Cloudflare Worker
- Workers KV namespace `STAFF_KV`
- keys:
  - `bootstrap:done`
  - `employees:index`
  - `employee:<id>`
  - `ratelimit:*`

Local Zustand persistence:
- shift data
- missions
- requests
- losses
- handoff
- timesheet entries
- session token

## Telegram Mini App Notes
- Load `telegram-web-app.js`.
- Call `tg.ready()` and `tg.expand()` on startup.
- Read `initDataUnsafe.user` only for display purposes.
- Do not treat Telegram init data in this MVP as secure authentication.
- Stronger access later should use Telegram `user_id` verification on backend.

## Done Criteria
- Project runs as a static React + TypeScript + Tailwind app plus a Worker API.
- Bootstrap owner is done once and shared across devices.
- Without a valid token the internal app and bottom nav are hidden.
- Owner can create employee, assign role and PIN, reset PIN, and archive access.
- PIN is never stored in plain text.
- Employee list is consistent across devices and browsers.
- Protected endpoints return `401` without valid token.
- Bottom nav has four sections and works inside Telegram-style mobile viewport.
- Shift screen shows progress, stages, and gated shift close CTA.
- Missions flow supports create, done, accept, return with local persistence.
- Requests screen supports local request creation and external-form links.
- Profile shows current employee data, logout, personal stats, and weekly neutral metrics.
- Profile supports timesheet controls, editable rate for chef/owner roles, and privacy-hidden earnings.
- Timesheet screen lists shifts for week/month with early start reasons.
- Early shift start requires a reason before opening.
- Owner dashboard shows team hour aggregates and early-start statistics.
- Losses screen calculates operational damage with multiplier `1.2`.
- Handoff screen supports kitchen and bar checklists with criticality.
- Telegram WebApp bootstrap is wired and username display uses `initDataUnsafe.user` when available.
- No secrets are stored in repo.
- Frontend build is static and suitable for Cloudflare Pages.

## Non-Goals for MVP
- Supabase
- Cloudflare Access
- Telegram identity verification
- File uploads
- Push notifications
- Production analytics
- Real leaderboards with negative comparisons
