# Restaurant OS MVP

## Product Goal
Restaurant OS is a Telegram Mini App for restaurant staff that replaces scattered chats, pinned links, and forms with one mobile-first shift workspace. The MVP is intentionally local-first and optimized for quick shift actions with minimal typing.

## Users and Roles
- `Employee`: default role. Can work with shift flow, submit requests, mark missions as done, fill losses and handoff.
- `Owner/Admin`: same access as Employee plus task creation and acceptance flow. In MVP the role is switched manually in profile settings. Later it should be mapped to Telegram user IDs via backend whitelist.

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

## Storage Strategy
- Zustand store persisted in `localStorage`.
- Mock seed data is loaded from `src/data/mock.ts`.
- Data layer is shaped to be replaced by Supabase later without redesigning the screens.

## Done Criteria
- Project runs as a static React + TypeScript + Tailwind app.
- Bottom nav has four sections and works inside Telegram-style mobile viewport.
- Shift screen shows progress, stages, and gated shift close CTA.
- Missions flow supports create, done, accept, return with local persistence.
- Requests screen supports local request creation and external-form links.
- Profile shows role switch, personal stats, and weekly neutral metrics.
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

