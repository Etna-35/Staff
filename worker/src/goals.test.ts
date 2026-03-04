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

  it('allows owner to create and delete demo goal tasks', async () => {
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

    const createResponse = await worker.fetch(
      apiRequest('/api/goals/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: 'Demo задача на отзывы',
          scope: 'global',
          department: 'waiters',
          points: 3,
          targetCount: 2,
        }),
      }),
      env as never,
    );
    const createPayload = await createResponse.json();
    const createdTask = createPayload.tasks.find((task: Record<string, unknown>) =>
      String(task.id).startsWith('goal-demo-'),
    );

    expect(createResponse.status).toBe(201);
    expect(createdTask?.title).toBe('Demo задача на отзывы');

    const adminResponse = await worker.fetch(
      apiRequest('/api/goals/tasks', {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
      env as never,
    );
    const adminPayload = await adminResponse.json();

    expect(adminPayload.tasks.some((task: Record<string, unknown>) => task.id === createdTask.id)).toBe(
      true,
    );

    const deleteResponse = await worker.fetch(
      apiRequest(`/api/goals/tasks/${createdTask.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
      env as never,
    );
    const deletePayload = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload.tasks.some((task: Record<string, unknown>) => task.id === createdTask.id)).toBe(
      false,
    );
  });

  it('sanitizes legacy hookah goal tasks from KV before returning admin payload', async () => {
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

    await worker.fetch(
      apiRequest('/api/goals/active', {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
      env as never,
    );

    await env.STAFF_KV.put(
      'goals:tasks',
      JSON.stringify([
        {
          id: 'legacy-hookah-role',
          scope: 'role',
          role: 'hookah',
          title: 'Старый кальянный таск',
          department: 'other',
          points: 1,
          status: 'todo',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'legacy-hookah-department',
          scope: 'global',
          title: 'Старый отдел',
          department: 'hookah',
          points: 1,
          status: 'todo',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'valid-bar-task',
          scope: 'global',
          title: 'Актуальная задача',
          department: 'bar',
          points: 2,
          status: 'todo',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ]),
    );

    const adminResponse = await worker.fetch(
      apiRequest('/api/goals/tasks', {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
      env as never,
    );
    const adminPayload = await adminResponse.json();

    expect(adminResponse.status).toBe(200);
    expect(
      adminPayload.tasks.some((task: Record<string, unknown>) => task.id === 'legacy-hookah-role'),
    ).toBe(false);
    expect(
      adminPayload.tasks.some((task: Record<string, unknown>) => task.id === 'legacy-hookah-department'),
    ).toBe(false);
    expect(
      adminPayload.tasks.some((task: Record<string, unknown>) => task.id === 'valid-bar-task'),
    ).toBe(true);

    const persistedTasks = JSON.parse((await env.STAFF_KV.get('goals:tasks')) ?? '[]') as Array<{
      id: string;
    }>;
    expect(persistedTasks.some((task) => task.id === 'legacy-hookah-role')).toBe(false);
    expect(persistedTasks.some((task) => task.id === 'legacy-hookah-department')).toBe(false);
    expect(persistedTasks.some((task) => task.id === 'valid-bar-task')).toBe(true);
  });
});
