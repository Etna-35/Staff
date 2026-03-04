/* worker/src/index.ts
   Restaurant OS API (Workers + KV) — Full Employees API
*/
import {
  applyTaskProgress,
  buildContributionsFromTasks,
  buildDefaultGoalMetric,
  buildGoalPeriod,
  buildInitialProgressMap,
  createDefaultGoalTasks,
  createDefaultPersonalTask,
  createEmptyGoalContributions,
  Department,
  getMetricCurrentValue,
  getVisibleGoalTasks,
  GoalContribution,
  GoalMetric,
  GoalPeriod,
  GoalPeriodType,
  GoalProgressMap,
  GoalTask,
  normalizeGoalContributions,
  Role,
  mergeGoalTasksWithProgress,
} from "./goals";

type Employee = {
  id: string;
  fullName: string;
  role: Role;
  positionTitle: string;
  hourlyRate: number | null;
  pinSalt: string;
  pinHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EmployeePublic = Pick<Employee, "id" | "fullName" | "role" | "positionTitle" | "hourlyRate" | "isActive">;

type ShiftMood = "sad" | "tired" | "okay" | "happy" | "amazing";

type ShiftReflection = {
  id: string;
  dateKey: string;
  employeeId: string;
  mood: ShiftMood;
  starRecipientId: string | null;
  createdAt: string;
  updatedAt: string;
};

type SpecialStarAward = {
  id: string;
  dateKey: string;
  employeeId: string;
  issuedByEmployeeId: string;
  createdAt: string;
};

type BonusAward = {
  id: string;
  dateKey: string;
  employeeId: string;
  issuedByEmployeeId: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

type Env = {
  STAFF_KV: KVNamespace;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN?: string; // e.g. "https://etnastaff.pages.dev"
};

const EMP_INDEX_KEY = "employees:index";
const BOOTSTRAP_KEY = "bootstrap:done";
const SHIFT_REFLECTION_PREFIX = "shift-reflection:";
const SPECIAL_STAR_PREFIX = "special-star:";
const BONUS_AWARD_PREFIX = "bonus-award:";
const GOALS_ACTIVE_KEY = "goals:active";
const GOALS_TASKS_KEY = "goals:tasks";
const GOALS_PROGRESS_PREFIX = "goals:progress:";
const GOALS_CONTRIB_PREFIX = "goals:contrib:";
const GOALS_RATE_PREFIX = "goals:rate:";

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 });
}
function unauthorized(message = "Unauthorized") {
  return json({ ok: false, error: message }, { status: 401 });
}
function forbidden(message = "Forbidden") {
  return json({ ok: false, error: message }, { status: 403 });
}
function notFound(message = "Not found") {
  return json({ ok: false, error: message }, { status: 404 });
}
function conflict(message: string) {
  return json({ ok: false, error: message }, { status: 409 });
}
function tooManyRequests(message: string) {
  return json({ ok: false, error: message }, { status: 429 });
}

function normalizeOrigin(o?: string) {
  if (!o) return "";
  return o.endsWith("/") ? o.slice(0, -1) : o;
}

function withCors(request: Request, env: Env, resp: Response) {
  const origin = request.headers.get("origin") || "";
  const allowed = normalizeOrigin(env.ALLOWED_ORIGIN);
  const headers = new Headers(resp.headers);

  // Allow localhost for dev
  const isLocalhost =
    origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");

  // Telegram/iOS WebView иногда шлёт Origin: null
  const isNullOrigin = origin === "null" || origin === "";

  const isAllowed = isLocalhost || (allowed && origin === allowed) || isNullOrigin;

  // Если origin пустой/нормальный — ставим allow-origin
  // (credentials НЕ нужны, т.к. мы используем Authorization header)
  headers.set("access-control-allow-origin", isNullOrigin ? "*" : origin);
  headers.set("vary", "Origin");

  headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization");

  // Если origin вообще не разрешён — можно запретить (не обязательно, но правильно)
  if (!isAllowed) {
    return new Response(resp.body, {
      status: 403,
      headers,
    });
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}

async function readJson<T>(request: Request): Promise<T | null> {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return (await request.json()) as T;
}

function isValidPin(pin: string) {
  return /^[0-9]{4,6}$/.test(pin);
}

function randomId(prefix = "") {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}

function toBase64Url(bytes: Uint8Array) {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromUtf8(str: string) {
  return new TextEncoder().encode(str);
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", fromUtf8(input));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    fromUtf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, fromUtf8(data));
  return toBase64Url(new Uint8Array(sig));
}

type SessionPayload = {
  employeeId: string;
  role: Role;
  iat: number;
  exp: number;
};

async function signToken(env: Env, payload: SessionPayload): Promise<string> {
  const body = toBase64Url(fromUtf8(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

async function verifyToken(env: Env, token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expected = await hmacSha256Base64Url(env.SESSION_SECRET, body);
  if (expected !== sig) return null;

  try {
    const jsonStr = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(jsonStr) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!payload?.employeeId || !payload?.role || !payload?.exp) return null;
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function extractBearer(request: Request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function getEmployeesIndex(env: Env): Promise<string[]> {
  const raw = await env.STAFF_KV.get(EMP_INDEX_KEY);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? (ids as string[]) : [];
  } catch {
    return [];
  }
}

async function setEmployeesIndex(env: Env, ids: string[]) {
  await env.STAFF_KV.put(EMP_INDEX_KEY, JSON.stringify(ids));
}

async function getEmployee(env: Env, id: string): Promise<Employee | null> {
  const raw = await env.STAFF_KV.get(`employee:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Employee;
  } catch {
    return null;
  }
}

async function putEmployee(env: Env, emp: Employee) {
  await env.STAFF_KV.put(`employee:${emp.id}`, JSON.stringify(emp));
}

function toPublic(emp: Employee): EmployeePublic {
  const { id, fullName, role, positionTitle, hourlyRate, isActive } = emp;
  return { id, fullName, role, positionTitle, hourlyRate, isActive };
}

function assertOwner(session: SessionPayload | null) {
  return session && session.role === "owner";
}

function isValidDateKey(dateKey: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function getStartOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

function getDateKeysForPeriod(period: "day" | "week" | "month", dateKey: string) {
  if (period === "day") {
    return [dateKey];
  }

  if (period === "month") {
    const start = parseDateKey(dateKey);
    start.setUTCDate(1);
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const keys: string[] = [];

    for (let index = 0; index < daysInMonth; index += 1) {
      const value = new Date(Date.UTC(year, month, index + 1));
      keys.push(formatDateKey(value));
    }

    return keys;
  }

  const start = getStartOfWeek(parseDateKey(dateKey));
  const keys: string[] = [];

  for (let index = 0; index < 7; index += 1) {
    const value = new Date(start);
    value.setUTCDate(start.getUTCDate() + index);
    keys.push(formatDateKey(value));
  }

  return keys;
}

function getShiftReflectionKey(dateKey: string, employeeId: string) {
  return `${SHIFT_REFLECTION_PREFIX}${dateKey}:${employeeId}`;
}

function getSpecialStarKey(dateKey: string, awardId: string) {
  return `${SPECIAL_STAR_PREFIX}${dateKey}:${awardId}`;
}

function getBonusAwardKey(dateKey: string, awardId: string) {
  return `${BONUS_AWARD_PREFIX}${dateKey}:${awardId}`;
}

async function getShiftReflectionsForDate(env: Env, dateKey: string): Promise<ShiftReflection[]> {
  const listed = await env.STAFF_KV.list({ prefix: `${SHIFT_REFLECTION_PREFIX}${dateKey}:` });

  const values = await Promise.all(
    listed.keys.map(async ({ name }) => {
      const raw = await env.STAFF_KV.get(name);
      if (!raw) return null;

      try {
        return JSON.parse(raw) as ShiftReflection;
      } catch {
        return null;
      }
    })
  );

  return values.filter((value): value is ShiftReflection => Boolean(value));
}

async function getShiftReflectionsForPeriod(
  env: Env,
  period: "day" | "week" | "month",
  dateKey: string
): Promise<ShiftReflection[]> {
  const dateKeys = getDateKeysForPeriod(period, dateKey);
  const grouped = await Promise.all(dateKeys.map((key) => getShiftReflectionsForDate(env, key)));

  return grouped
    .flat()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getSpecialStarAwardsForDate(
  env: Env,
  dateKey: string
): Promise<SpecialStarAward[]> {
  const listed = await env.STAFF_KV.list({ prefix: `${SPECIAL_STAR_PREFIX}${dateKey}:` });

  const values = await Promise.all(
    listed.keys.map(async ({ name }) => {
      const raw = await env.STAFF_KV.get(name);
      if (!raw) return null;

      try {
        return JSON.parse(raw) as SpecialStarAward;
      } catch {
        return null;
      }
    })
  );

  return values.filter((value): value is SpecialStarAward => Boolean(value));
}

async function getSpecialStarAwardsForPeriod(
  env: Env,
  period: "day" | "week" | "month",
  dateKey: string
): Promise<SpecialStarAward[]> {
  const dateKeys = getDateKeysForPeriod(period, dateKey);
  const grouped = await Promise.all(
    dateKeys.map((key) => getSpecialStarAwardsForDate(env, key))
  );

  return grouped
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function getBonusAwardsForDate(env: Env, dateKey: string): Promise<BonusAward[]> {
  const listed = await env.STAFF_KV.list({ prefix: `${BONUS_AWARD_PREFIX}${dateKey}:` });

  const values = await Promise.all(
    listed.keys.map(async ({ name }) => {
      const raw = await env.STAFF_KV.get(name);
      if (!raw) return null;

      try {
        return JSON.parse(raw) as BonusAward;
      } catch {
        return null;
      }
    })
  );

  return values.filter((value): value is BonusAward => Boolean(value));
}

async function getBonusAwardsForPeriod(
  env: Env,
  period: "day" | "week" | "month",
  dateKey: string
): Promise<BonusAward[]> {
  const dateKeys = getDateKeysForPeriod(period, dateKey);
  const grouped = await Promise.all(dateKeys.map((key) => getBonusAwardsForDate(env, key)));

  return grouped
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getGoalsProgressKey(periodId: string) {
  return `${GOALS_PROGRESS_PREFIX}${periodId}`;
}

function getGoalsContributionKey(periodId: string) {
  return `${GOALS_CONTRIB_PREFIX}${periodId}`;
}

function getGoalsRateKey(employeeId: string) {
  return `${GOALS_RATE_PREFIX}${employeeId}`;
}

async function getGoalsActive(env: Env): Promise<{ period: GoalPeriod; metric: GoalMetric } | null> {
  const raw = await env.STAFF_KV.get(GOALS_ACTIVE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { period: GoalPeriod; metric: GoalMetric };
  } catch {
    return null;
  }
}

async function putGoalsActive(
  env: Env,
  payload: { period: GoalPeriod; metric: GoalMetric },
) {
  await env.STAFF_KV.put(GOALS_ACTIVE_KEY, JSON.stringify(payload));
}

async function getGoalTasks(env: Env): Promise<GoalTask[]> {
  const raw = await env.STAFF_KV.get(GOALS_TASKS_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as GoalTask[];
  } catch {
    return [];
  }
}

async function putGoalTasks(env: Env, tasks: GoalTask[]) {
  await env.STAFF_KV.put(GOALS_TASKS_KEY, JSON.stringify(tasks));
}

async function getGoalProgressMap(env: Env, periodId: string): Promise<GoalProgressMap> {
  const raw = await env.STAFF_KV.get(getGoalsProgressKey(periodId));
  if (!raw) return {};

  try {
    return JSON.parse(raw) as GoalProgressMap;
  } catch {
    return {};
  }
}

async function putGoalProgressMap(env: Env, periodId: string, progressMap: GoalProgressMap) {
  await env.STAFF_KV.put(getGoalsProgressKey(periodId), JSON.stringify(progressMap));
}

async function getGoalContributions(
  env: Env,
  periodId: string,
): Promise<Record<Department, GoalContribution>> {
  const raw = await env.STAFF_KV.get(getGoalsContributionKey(periodId));
  if (!raw) {
    return createEmptyGoalContributions();
  }

  try {
    return normalizeGoalContributions(JSON.parse(raw) as Record<Department, GoalContribution>);
  } catch {
    return createEmptyGoalContributions();
  }
}

async function putGoalContributions(
  env: Env,
  periodId: string,
  contributions: Record<Department, GoalContribution>,
) {
  await env.STAFF_KV.put(
    getGoalsContributionKey(periodId),
    JSON.stringify(normalizeGoalContributions(contributions)),
  );
}

async function ensureGoalsData(
  env: Env,
  employee?: { id: string; role: Role } | null,
) {
  const now = new Date();
  const nowIso = now.toISOString();

  let active = await getGoalsActive(env);
  if (!active) {
    const period = buildGoalPeriod("month", now);
    const tasks = createDefaultGoalTasks(nowIso);
    const progressMap = buildInitialProgressMap(tasks);
    const contributions = buildContributionsFromTasks(tasks);
    const metric = {
      ...buildDefaultGoalMetric(120),
      currentValue: getMetricCurrentValue(contributions),
    };

    active = { period, metric };
    await putGoalsActive(env, active);
    await putGoalTasks(env, tasks);
    await putGoalProgressMap(env, period.id, progressMap);
    await putGoalContributions(env, period.id, contributions);
  }

  let tasks = await getGoalTasks(env);
  if (tasks.length === 0) {
    tasks = createDefaultGoalTasks(nowIso);
    await putGoalTasks(env, tasks);
    const contributions = buildContributionsFromTasks(tasks);
    await putGoalProgressMap(env, active.period.id, buildInitialProgressMap(tasks));
    await putGoalContributions(env, active.period.id, contributions);
    await putGoalsActive(env, {
      period: active.period,
      metric: {
        ...active.metric,
        currentValue: getMetricCurrentValue(contributions),
      },
    });
  }

  if (employee) {
    const hasPersonalTask = tasks.some(
      (task) => task.scope === "personal" && task.employeeId === employee.id,
    );

    if (!hasPersonalTask) {
      const personalTask = createDefaultPersonalTask(employee.id, employee.role, nowIso);
      tasks = [...tasks, personalTask];
      await putGoalTasks(env, tasks);

      const progressMap = await getGoalProgressMap(env, active.period.id);
      await putGoalProgressMap(env, active.period.id, {
        ...progressMap,
        [personalTask.id]: {
          progressCount: personalTask.progressCount ?? 0,
          status: personalTask.status,
          updatedAt: personalTask.updatedAt,
          completedAt: personalTask.completedAt,
        },
      });
    }
  }

  const progressMap = await getGoalProgressMap(env, active.period.id);
  const contributions = await getGoalContributions(env, active.period.id);
  const mergedTasks = mergeGoalTasksWithProgress(tasks, progressMap);
  const nextMetric = {
    ...active.metric,
    currentValue: getMetricCurrentValue(contributions),
  };

  if (nextMetric.currentValue !== active.metric.currentValue) {
    active = {
      period: active.period,
      metric: nextMetric,
    };
    await putGoalsActive(env, active);
  }

  return {
    activePeriod: active.period,
    metric: nextMetric,
    tasks: mergedTasks,
    contributions,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(request, env, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health
    if (request.method === "GET" && path === "/api/health") {
      return withCors(request, env, json({ ok: true }));
    }

    // Bootstrap status
    if (request.method === "GET" && path === "/api/bootstrap/status") {
      const done = (await env.STAFF_KV.get(BOOTSTRAP_KEY)) === "1";
      return withCors(request, env, json({ ok: true, bootstrapped: done }));
    }

    // Bootstrap owner (one-time)
    if (request.method === "POST" && path === "/api/bootstrap") {
      const done = (await env.STAFF_KV.get(BOOTSTRAP_KEY)) === "1";
      if (done) return withCors(request, env, conflict("already bootstrapped"));

      const body = await readJson<{ fullName: string; pin: string }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const fullName = (body.fullName || "").trim();
      const pin = (body.pin || "").trim();

      if (!fullName) return withCors(request, env, badRequest("fullName is required"));
      if (!isValidPin(pin)) return withCors(request, env, badRequest("PIN must be 4-6 digits"));

      const salt = randomId("salt");
      const hash = await sha256Hex(pin + salt);
      const nowIso = new Date().toISOString();

      const owner: Employee = {
        id: randomId("emp"),
        fullName,
        role: "owner",
        positionTitle: "Владелец",
        hourlyRate: null,
        pinSalt: salt,
        pinHash: hash,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const ids = await getEmployeesIndex(env);
      ids.push(owner.id);
      await setEmployeesIndex(env, ids);
      await putEmployee(env, owner);
      await env.STAFF_KV.put(BOOTSTRAP_KEY, "1");

      const now = Math.floor(Date.now() / 1000);
      const token = await signToken(env, {
        employeeId: owner.id,
        role: "owner",
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
      });

      return withCors(request, env, json({ ok: true, sessionToken: token, employee: toPublic(owner) }));
    }

    // Public list for login screen
    if (request.method === "GET" && path === "/api/employees/public") {
      const done = (await env.STAFF_KV.get(BOOTSTRAP_KEY)) === "1";
      if (!done) return withCors(request, env, conflict("not bootstrapped"));

      const ids = await getEmployeesIndex(env);
      const emps: EmployeePublic[] = [];
      for (const id of ids) {
        const emp = await getEmployee(env, id);
        if (emp && emp.isActive) emps.push(toPublic(emp));
      }
      return withCors(request, env, json({ ok: true, employees: emps }));
    }

    // Auth login
    if (request.method === "POST" && path === "/api/auth/login") {
      const body = await readJson<{ employeeId: string; pin: string }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const employeeId = (body.employeeId || "").trim();
      const pin = (body.pin || "").trim();

      if (!employeeId) return withCors(request, env, badRequest("employeeId is required"));
      if (!isValidPin(pin)) return withCors(request, env, badRequest("PIN must be 4-6 digits"));

      const emp = await getEmployee(env, employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized("Invalid credentials"));

      const hash = await sha256Hex(pin + emp.pinSalt);
      if (hash !== emp.pinHash) return withCors(request, env, unauthorized("Invalid credentials"));

      const now = Math.floor(Date.now() / 1000);
      const token = await signToken(env, {
        employeeId: emp.id,
        role: emp.role,
        iat: now,
        exp: now + 60 * 60 * 24 * 7, // 7 days
      });

      return withCors(request, env, json({ ok: true, sessionToken: token, employee: toPublic(emp) }));
    }

    // Authenticated routes
    const bearer = extractBearer(request);
    const session = bearer ? await verifyToken(env, bearer) : null;

    // /api/me
    if (request.method === "GET" && path === "/api/me") {
      if (!session) return withCors(request, env, unauthorized());
      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());
      return withCors(request, env, json({ ok: true, employee: toPublic(emp) }));
    }

    if (request.method === "POST" && path === "/api/me/change-pin") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const body = await readJson<{ currentPin: string; newPin: string }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const currentPin = (body.currentPin || "").trim();
      const newPin = (body.newPin || "").trim();

      if (!isValidPin(currentPin)) {
        return withCors(request, env, badRequest("Current PIN must be 4-6 digits"));
      }

      if (!isValidPin(newPin)) {
        return withCors(request, env, badRequest("New PIN must be 4-6 digits"));
      }

      const currentHash = await sha256Hex(currentPin + emp.pinSalt);
      if (currentHash !== emp.pinHash) {
        return withCors(request, env, badRequest("Current PIN is incorrect"));
      }

      const nextSalt = randomId("salt");
      const nextHash = await sha256Hex(newPin + nextSalt);

      await putEmployee(env, {
        ...emp,
        pinSalt: nextSalt,
        pinHash: nextHash,
        updatedAt: new Date().toISOString(),
      });

      return withCors(request, env, json({ ok: true }));
    }

    if (request.method === "POST" && path === "/api/me/hourly-rate") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const body = await readJson<{ hourlyRate: number | null }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const hourlyRate =
        typeof body.hourlyRate === "number" && body.hourlyRate > 0 ? body.hourlyRate : null;

      const updated = {
        ...emp,
        hourlyRate,
        updatedAt: new Date().toISOString(),
      };

      await putEmployee(env, updated);
      return withCors(request, env, json({ ok: true, employee: toPublic(updated) }));
    }

    if (request.method === "GET" && path === "/api/shift-reflections") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const rawPeriod = url.searchParams.get("period");
      const period =
        rawPeriod === "day" || rawPeriod === "month" ? rawPeriod : "week";
      const dateKey = (url.searchParams.get("dateKey") || "").trim();

      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      const reflections = await getShiftReflectionsForPeriod(env, period, dateKey);
      return withCors(request, env, json({ ok: true, reflections }));
    }

    if (request.method === "POST" && path === "/api/shift-reflections") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const body = await readJson<{ dateKey: string; mood: ShiftMood; starRecipientId?: string | null }>(
        request
      );
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const dateKey = (body.dateKey || "").trim();
      const mood = body.mood;
      const starRecipientId = body.starRecipientId ? body.starRecipientId.trim() : null;

      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      if (!["sad", "tired", "okay", "happy", "amazing"].includes(mood)) {
        return withCors(request, env, badRequest("invalid mood"));
      }

      if (starRecipientId === emp.id) {
        return withCors(request, env, badRequest("Нельзя подарить звездочку себе"));
      }

      if (starRecipientId) {
        const recipient = await getEmployee(env, starRecipientId);
        if (!recipient || !recipient.isActive) {
          return withCors(request, env, badRequest("Получатель звездочки не найден"));
        }
      }

      const key = getShiftReflectionKey(dateKey, emp.id);
      const existing = await env.STAFF_KV.get(key);
      if (existing) {
        return withCors(request, env, conflict("today reflection already submitted"));
      }

      const nowIso = new Date().toISOString();
      const reflection: ShiftReflection = {
        id: randomId("reflection"),
        dateKey,
        employeeId: emp.id,
        mood,
        starRecipientId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await env.STAFF_KV.put(key, JSON.stringify(reflection));

      return withCors(request, env, json({ ok: true, reflection }, { status: 201 }));
    }

    if (request.method === "GET" && path === "/api/special-stars") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const rawPeriod = url.searchParams.get("period");
      const period =
        rawPeriod === "day" || rawPeriod === "month" ? rawPeriod : "week";
      const dateKey = (url.searchParams.get("dateKey") || "").trim();

      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      const awards = await getSpecialStarAwardsForPeriod(env, period, dateKey);
      return withCors(request, env, json({ ok: true, awards }));
    }

    if (request.method === "POST" && path === "/api/special-stars") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const body = await readJson<{ employeeId: string; dateKey: string }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const employeeId = (body.employeeId || "").trim();
      const dateKey = (body.dateKey || "").trim();

      if (!employeeId) return withCors(request, env, badRequest("employeeId is required"));
      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      const recipient = await getEmployee(env, employeeId);
      if (!recipient || !recipient.isActive) {
        return withCors(request, env, badRequest("Employee not found"));
      }

      const award: SpecialStarAward = {
        id: randomId("special_star"),
        dateKey,
        employeeId,
        issuedByEmployeeId: session.employeeId,
        createdAt: new Date().toISOString(),
      };

      await env.STAFF_KV.put(getSpecialStarKey(dateKey, award.id), JSON.stringify(award));

      return withCors(request, env, json({ ok: true, award }, { status: 201 }));
    }

    if (request.method === "GET" && path === "/api/bonus-awards") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const rawPeriod = url.searchParams.get("period");
      const period =
        rawPeriod === "day" || rawPeriod === "week" ? rawPeriod : "month";
      const dateKey = (url.searchParams.get("dateKey") || "").trim();

      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      const awards = await getBonusAwardsForPeriod(env, period, dateKey);
      const visibleAwards =
        session.role === "owner"
          ? awards
          : awards.filter((award) => award.employeeId === session.employeeId);

      return withCors(request, env, json({ ok: true, awards: visibleAwards }));
    }

    if (request.method === "POST" && path === "/api/bonus-awards") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const body = await readJson<{ employeeId: string; dateKey: string; amount: number; note?: string | null }>(
        request
      );
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const employeeId = (body.employeeId || "").trim();
      const dateKey = (body.dateKey || "").trim();
      const amount = typeof body.amount === "number" ? body.amount : 0;
      const note = typeof body.note === "string" ? body.note.trim() || null : null;

      if (!employeeId) return withCors(request, env, badRequest("employeeId is required"));
      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }
      if (!(amount > 0)) {
        return withCors(request, env, badRequest("amount must be greater than 0"));
      }

      const recipient = await getEmployee(env, employeeId);
      if (!recipient || !recipient.isActive) {
        return withCors(request, env, badRequest("Employee not found"));
      }

      const award: BonusAward = {
        id: randomId("bonus"),
        dateKey,
        employeeId,
        issuedByEmployeeId: session.employeeId,
        amount,
        note,
        createdAt: new Date().toISOString(),
      };

      await env.STAFF_KV.put(getBonusAwardKey(dateKey, award.id), JSON.stringify(award));

      return withCors(request, env, json({ ok: true, award }, { status: 201 }));
    }

    if (request.method === "GET" && path === "/api/goals/active") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const goals = await ensureGoalsData(env, { id: emp.id, role: emp.role });
      const visibleTasks = getVisibleGoalTasks(goals.tasks, {
        employeeId: emp.id,
        role: emp.role,
      });

      return withCors(
        request,
        env,
        json({
          ok: true,
          activePeriod: goals.activePeriod,
          metric: goals.metric,
          tasks: visibleTasks,
          contributions: goals.contributions,
        }),
      );
    }

    const goalTaskProgressMatch = path.match(/^\/api\/goals\/task\/([^/]+)\/progress$/);

    if (goalTaskProgressMatch && request.method === "POST") {
      if (!session) return withCors(request, env, unauthorized());

      const emp = await getEmployee(env, session.employeeId);
      if (!emp || !emp.isActive) return withCors(request, env, unauthorized());

      const rateKey = getGoalsRateKey(emp.id);
      const nowMs = Date.now();
      const lastActionRaw = await env.STAFF_KV.get(rateKey);
      const lastActionMs = lastActionRaw ? Number(lastActionRaw) : 0;

      if (lastActionMs && nowMs - lastActionMs < 500) {
        return withCors(request, env, tooManyRequests("Слишком быстро. Повторите через секунду."));
      }

      const body = await readJson<{ delta?: number }>(request);
      const requestedDelta = typeof body?.delta === "number" ? body.delta : 1;

      if (requestedDelta < 1) {
        return withCors(request, env, badRequest("delta must be greater than 0"));
      }

      const taskId = goalTaskProgressMatch[1];
      const goals = await ensureGoalsData(env, { id: emp.id, role: emp.role });
      const visibleTasks = getVisibleGoalTasks(goals.tasks, {
        employeeId: emp.id,
        role: emp.role,
      });
      const task = visibleTasks.find((item) => item.id === taskId);

      if (!task) {
        return withCors(request, env, notFound("Goal task not found"));
      }

      const progressMap = await getGoalProgressMap(env, goals.activePeriod.id);
      const contributions = await getGoalContributions(env, goals.activePeriod.id);
      const updatedAt = new Date().toISOString();
      const applied = applyTaskProgress(task, progressMap, contributions, requestedDelta, updatedAt);
      const nextMetric = {
        ...goals.metric,
        currentValue: getMetricCurrentValue(applied.contributions),
      };

      await putGoalProgressMap(env, goals.activePeriod.id, applied.progressMap);
      await putGoalContributions(env, goals.activePeriod.id, applied.contributions);
      await putGoalsActive(env, {
        period: goals.activePeriod,
        metric: nextMetric,
      });
      await env.STAFF_KV.put(rateKey, String(nowMs), { expirationTtl: 60 });

      return withCors(
        request,
        env,
        json({
          ok: true,
          task: applied.task,
          metric: nextMetric,
          contributions: applied.contributions,
        }),
      );
    }

    if (request.method === "POST" && path === "/api/goals/active") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const body = await readJson<{
        type: GoalPeriodType;
        targetValue: number;
        title?: string;
        unit?: string;
        label?: string;
        resetProgress?: boolean;
      }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      if (!(body.targetValue > 0)) {
        return withCors(request, env, badRequest("targetValue must be greater than 0"));
      }

      const type = body.type === "week" ? "week" : "month";
      const period = buildGoalPeriod(type, new Date(), body.title?.trim() || undefined);
      const currentGoals = await ensureGoalsData(env, { id: session.employeeId, role: session.role });
      const shouldReset =
        Boolean(body.resetProgress) || currentGoals.activePeriod.id !== period.id;
      const tasks = await getGoalTasks(env);
      const progressMap = shouldReset
        ? tasks.reduce<GoalProgressMap>((result, task) => {
            result[task.id] = {
              progressCount: 0,
              status: "todo",
              updatedAt: new Date().toISOString(),
            };
            return result;
          }, {})
        : await getGoalProgressMap(env, currentGoals.activePeriod.id);
      const contributions = shouldReset
        ? createEmptyGoalContributions()
        : await getGoalContributions(env, currentGoals.activePeriod.id);
      const metric: GoalMetric = {
        type: "custom",
        unit: body.unit?.trim() || "pts",
        targetValue: body.targetValue,
        currentValue: getMetricCurrentValue(contributions),
        label: body.label?.trim() || "Командный прогресс",
      };

      await putGoalsActive(env, { period, metric });
      await putGoalProgressMap(env, period.id, progressMap);
      await putGoalContributions(env, period.id, contributions);

      const visibleTasks = getVisibleGoalTasks(mergeGoalTasksWithProgress(tasks, progressMap), {
        employeeId: session.employeeId,
        role: session.role,
      });

      return withCors(
        request,
        env,
        json({
          ok: true,
          activePeriod: period,
          metric,
          tasks: visibleTasks,
          contributions,
        }),
      );
    }

    const bonusAwardMatch = path.match(/^\/api\/bonus-awards\/([^/]+)$/);

    if (bonusAwardMatch && request.method === "DELETE") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const awardId = bonusAwardMatch[1];
      const dateKey = (url.searchParams.get("dateKey") || "").trim();

      if (!isValidDateKey(dateKey)) {
        return withCors(request, env, badRequest("dateKey must be YYYY-MM-DD"));
      }

      const key = getBonusAwardKey(dateKey, awardId);
      const existing = await env.STAFF_KV.get(key);

      if (!existing) {
        return withCors(request, env, notFound("Bonus award not found"));
      }

      await env.STAFF_KV.delete(key);

      return withCors(request, env, json({ ok: true }));
    }

    // Owner-only list
    if (request.method === "GET" && path === "/api/employees") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const ids = await getEmployeesIndex(env);
      const emps: EmployeePublic[] = [];
      for (const id of ids) {
        const emp = await getEmployee(env, id);
        if (emp) emps.push(toPublic(emp));
      }
      return withCors(request, env, json({ ok: true, employees: emps }));
    }

    // Owner-only create
    if (request.method === "POST" && path === "/api/employees") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const body = await readJson<{ fullName: string; role: Role; positionTitle?: string; pin: string; hourlyRate?: number | null }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const fullName = (body.fullName || "").trim();
      const role = body.role;
      const positionTitle = (body.positionTitle || "").trim();
      const pin = (body.pin || "").trim();

      if (!fullName) return withCors(request, env, badRequest("fullName is required"));
      if (!role || !["waiter", "bartender", "chef", "owner"].includes(role))
        return withCors(request, env, badRequest("invalid role"));
      if (!isValidPin(pin)) return withCors(request, env, badRequest("PIN must be 4-6 digits"));

      const salt = randomId("salt");
      const hash = await sha256Hex(pin + salt);
      const nowIso = new Date().toISOString();

      const emp: Employee = {
        id: randomId("emp"),
        fullName,
        role,
        positionTitle:
          positionTitle ||
          (role === "waiter" ? "Официант" : role === "bartender" ? "Бармен" : role === "chef" ? "Повар" : "Владелец"),
        hourlyRate: typeof body.hourlyRate === "number" && body.hourlyRate > 0 ? body.hourlyRate : null,
        pinSalt: salt,
        pinHash: hash,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const ids = await getEmployeesIndex(env);
      ids.push(emp.id);
      await setEmployeesIndex(env, ids);
      await putEmployee(env, emp);

      return withCors(request, env, json({ ok: true, employee: toPublic(emp) }, { status: 201 }));
    }

    // Owner-only patch/delete/reset-pin
    const empIdMatch = path.match(/^\/api\/employees\/([^/]+)$/);
    const resetMatch = path.match(/^\/api\/employees\/([^/]+)\/reset-pin$/);

    if (resetMatch && request.method === "POST") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const id = resetMatch[1];
      const emp = await getEmployee(env, id);
      if (!emp) return withCors(request, env, notFound("Employee not found"));

      const body = await readJson<{ pin: string }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const pin = (body.pin || "").trim();
      if (!isValidPin(pin)) return withCors(request, env, badRequest("PIN must be 4-6 digits"));

      const salt = randomId("salt");
      const hash = await sha256Hex(pin + salt);

      await putEmployee(env, { ...emp, pinSalt: salt, pinHash: hash, updatedAt: new Date().toISOString() });
      return withCors(request, env, json({ ok: true }));
    }

    if (empIdMatch && request.method === "PATCH") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const id = empIdMatch[1];
      const emp = await getEmployee(env, id);
      if (!emp) return withCors(request, env, notFound("Employee not found"));

      const body = await readJson<{ role?: Role; positionTitle?: string; isActive?: boolean; hourlyRate?: number | null }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const nextRole = body.role && (["waiter", "bartender", "chef", "owner"] as Role[]).includes(body.role) ? body.role : emp.role;

      await putEmployee(env, {
        ...emp,
        role: nextRole,
        positionTitle: typeof body.positionTitle === "string" ? body.positionTitle.trim() : emp.positionTitle,
        hourlyRate:
          typeof body.hourlyRate === "number"
            ? body.hourlyRate > 0
              ? body.hourlyRate
              : null
            : emp.hourlyRate,
        isActive: typeof body.isActive === "boolean" ? body.isActive : emp.isActive,
        updatedAt: new Date().toISOString(),
      });

      const updated = await getEmployee(env, id);
      return withCors(request, env, json({ ok: true, employee: updated ? toPublic(updated) : toPublic(emp) }));
    }

    if (empIdMatch && request.method === "DELETE") {
      if (!assertOwner(session)) return withCors(request, env, session ? forbidden() : unauthorized());

      const id = empIdMatch[1];
      const emp = await getEmployee(env, id);
      if (!emp) return withCors(request, env, notFound("Employee not found"));

      await putEmployee(env, { ...emp, isActive: false, updatedAt: new Date().toISOString() });
      return withCors(request, env, json({ ok: true }));
    }

    return withCors(request, env, notFound());
  },
};
