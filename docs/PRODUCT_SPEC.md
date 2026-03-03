# Restaurant OS MVP

## Product Goal
Restaurant OS is a Telegram Mini App for restaurant staff that replaces scattered chats, pinned links, and forms with one mobile-first shift workspace. The MVP is intentionally local-first and optimized for quick shift actions with minimal typing.

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
- In MVP requests are stored locally.
- External Yandex Forms URLs are configurable in one central file.

### Employee
- `id: string`
- `fullName: string`
- `role: waiter | bartender | chef | owner`
- `positionTitle: string`
- `pinHash: string`
- `pinSalt: string`
- `isActive: boolean`
- `createdAt: string`
- `department: kitchen | bar | hall | other`
- `hourlyRate: number | null`
- `tenureLabel?: string`

Rules:
- Waiters use preset rate `190 ₽/hour`.
- Bartenders use preset rate `270 ₽/hour`.
- Chefs edit their own rate in profile.
- PIN is stored only as `sha-256(pin + global salt + employee salt)`.

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
- `isAuthenticated: boolean`
- `employeeId: string | null`
- `lastAuthAt: string | null`
- `rememberMe: boolean`
- `failedAttempts: number`
- `lockUntil: string | null`

Rules:
- App UI is hidden until a valid PIN session exists.
- Five failed attempts create a 5-minute local cooldown.
- If the active employee becomes inactive, the next validation logs them out.

## Access Control (PIN)
- On first launch, if there is no owner PIN, the app asks to set one for `Юра (Owner)`.
- PIN entry is numeric only, masked by default, with show/hide control.
- Login flow:
  - choose employee
  - enter PIN
  - compare hash locally with WebCrypto API
- Session is persisted in localStorage with:
  - `employeeId`
  - `lastAuthAt`
  - `rememberMe`
- This is light local protection against casual access, not a strong security boundary.

## Owner Staff Management
- Owner can:
  - add employee
  - edit role / position / active state
  - reset PIN
  - archive employee instead of deleting
- Archived employees stay in history and time records.

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

## Configuration
All editable URLs live in one file:
- `src/config/links.ts`

Current placeholders:
- Knowledge base URL
- Task chat URL
- Closing photo checklist URL
- External Yandex forms for kitchen, bar, supplies

## Telegram Mini App Notes
- Load `telegram-web-app.js`.
- Call `tg.ready()` and `tg.expand()` on startup.
- Read `initDataUnsafe.user` only for display purposes.
- Do not treat Telegram init data in this MVP as secure authentication.
- Access control in this stage is local PIN-based and independent from Telegram identity.

## Storage Strategy
- Zustand store persisted in `localStorage`.
- Mock seed data is loaded from `src/data/mock.ts`.
- Data layer is shaped to be replaced by Supabase later without redesigning the screens.

## Done Criteria
- Project runs as a static React + TypeScript + Tailwind app.
- Without a valid PIN session the internal app and bottom nav are hidden.
- Owner can create employee, assign role and PIN, reset PIN, and archive access.
- PIN is never stored in plain text.
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
- Build output is static and suitable for Cloudflare Pages.

## Non-Goals for MVP
- Real auth
- Backend or Supabase integration
- File uploads
- Push notifications
- Production analytics
- Real leaderboards with negative comparisons
