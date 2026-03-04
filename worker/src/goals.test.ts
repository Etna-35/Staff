// @vitest-environment node

import worker from './index';

class InMemoryKV {
  private storage = new Map<string, string>();

  async get(key: string) {
    return this.storage.get(key) ?? null;
  }

  async put(key: string, value: string) {
    this.storage.set(key, value);
  }

  async delete(key: string) {
    this.storage.delete(key);
  }

  async list(options?: { prefix?: string }) {
    const prefix = options?.prefix ?? '';
    return {
      keys: [...this.storage.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name })),
    };
  }
}

const createEnv = () => ({
  STAFF_KV: new InMemoryKV() as unknown as KVNamespace,
  SESSION_SECRET: 'test-secret',
  ALLOWED_ORIGIN: 'http://localhost:4173',
});

const apiRequest = (path: string, init?: RequestInit) =>
  new Request(`https://example.com${path}`, init);

describe('worker goals endpoints', () => {
  it('requires auth for goals active endpoint', async () => {
    const env = createEnv();
    const response = await worker.fetch(apiRequest('/api/goals/active'), env as never);

    expect(response.status).toBe(401);
  });

  it('returns only visible tasks for the current employee', async () => {
    const env = createEnv();
    const bootstrapResponse = await worker.fetch(
      apiRequest('/api/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'Юра', pin: '1234' }),
      }),
      env as never,
    );
    const bootstrapPayload = await bootstrapResponse.json();
    const ownerToken = bootstrapPayload.sessionToken as string;

    const createEmployeeResponse = await worker.fetch(
      apiRequest('/api/employees', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          fullName: 'Маша',
          role: 'waiter',
          positionTitle: 'Официант',
          pin: '4321',
        }),
      }),
      env as never,
    );
    const createEmployeePayload = await createEmployeeResponse.json();
    const waiterId = createEmployeePayload.employee.id as string;

    const loginResponse = await worker.fetch(
      apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId: waiterId, pin: '4321' }),
      }),
      env as never,
    );
    const loginPayload = await loginResponse.json();
    const waiterToken = loginPayload.sessionToken as string;

    const goalsResponse = await worker.fetch(
      apiRequest('/api/goals/active', {
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
      }),
      env as never,
    );
    const goalsPayload = await goalsResponse.json();
    const tasks = goalsPayload.tasks as Array<Record<string, unknown>>;

    expect(tasks.length).toBeGreaterThan(0);
    expect(
      tasks.every((task) => {
        if (task.scope === 'global') {
          return true;
        }

        if (task.scope === 'role') {
          return task.role === 'waiter';
        }

        return task.employeeId === waiterId;
      }),
    ).toBe(true);
  });

  it('increments task progress and updates contribution aggregates', async () => {
    const env = createEnv();
    const bootstrapResponse = await worker.fetch(
      apiRequest('/api/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: 'Юра', pin: '1234' }),
      }),
      env as never,
    );
    const bootstrapPayload = await bootstrapResponse.json();
    const ownerToken = bootstrapPayload.sessionToken as string;

    const goalsResponse = await worker.fetch(
      apiRequest('/api/goals/active', {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
      env as never,
    );
    const goalsPayload = await goalsResponse.json();
    const task = goalsPayload.tasks.find((item: Record<string, unknown>) => item.scope === 'global');
    const beforePoints = goalsPayload.contributions.waiters.pointsEarned as number;

    const progressResponse = await worker.fetch(
      apiRequest(`/api/goals/task/${task.id}/progress`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ delta: 1 }),
      }),
      env as never,
    );
    const progressPayload = await progressResponse.json();

    expect(progressResponse.status).toBe(200);
    expect(progressPayload.task.progressCount).toBeGreaterThan(task.progressCount);
    expect(progressPayload.metric.currentValue).toBeGreaterThan(0);
    expect(progressPayload.contributions.waiters.pointsEarned).toBeGreaterThanOrEqual(beforePoints);
  });
});
