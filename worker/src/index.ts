/* worker/src/index.ts
   Restaurant OS API (Workers + KV) — Full Employees API
*/
type Role = "waiter" | "bartender" | "chef" | "owner";

type Employee = {
  id: string;
  fullName: string;
  role: Role;
  positionTitle: string;
  pinSalt: string;
  pinHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EmployeePublic = Pick<Employee, "id" | "fullName" | "role" | "positionTitle" | "isActive">;

type Env = {
  STAFF_KV: KVNamespace;
  SESSION_SECRET: string;
  ALLOWED_ORIGIN?: string; // e.g. "https://etnastaff.pages.dev"
};

const EMP_INDEX_KEY = "employees:index";
const BOOTSTRAP_KEY = "bootstrap:done";

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

function normalizeOrigin(o?: string) {
  if (!o) return "";
  return o.endsWith("/") ? o.slice(0, -1) : o;
}

function withCors(request: Request, env: Env, resp: Response) {
  const origin = request.headers.get("origin") || "";
  const allowed = normalizeOrigin(env.ALLOWED_ORIGIN);
  const headers = new Headers(resp.headers);

  // Allow localhost for dev
  const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  const isAllowed = (allowed && origin === allowed) || isLocalhost;

  if (origin && isAllowed) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-credentials", "true");
  }

  headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization");

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
  const { id, fullName, role, positionTitle, isActive } = emp;
  return { id, fullName, role, positionTitle, isActive };
}

function assertOwner(session: SessionPayload | null) {
  return session && session.role === "owner";
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

      const body = await readJson<{ fullName: string; role: Role; positionTitle?: string; pin: string }>(request);
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

      const body = await readJson<{ role?: Role; positionTitle?: string; isActive?: boolean }>(request);
      if (!body) return withCors(request, env, badRequest("Expected JSON body"));

      const nextRole = body.role && (["waiter", "bartender", "chef", "owner"] as Role[]).includes(body.role) ? body.role : emp.role;

      await putEmployee(env, {
        ...emp,
        role: nextRole,
        positionTitle: typeof body.positionTitle === "string" ? body.positionTitle.trim() : emp.positionTitle,
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
