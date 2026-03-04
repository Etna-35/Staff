import type { AppState } from '../types/domain';

const now = new Date();

const isoAt = (dayOffset: number, hour: number, minute: number) => {
  const value = new Date(now);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};

const localDateKeyAt = (dayOffset: number) => {
  const value = new Date(now);
  value.setDate(value.getDate() + dayOffset);

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
};

export const mockState: AppState = {
  telegramName: 'Гость смены',
  shift: {
    id: 'shift-today',
    startedAt: now.toISOString(),
    dayLabel: 'Вечерняя смена',
    leftoversChecked: false,
    closingPhotosChecked: false,
  },
  tasks: [
    {
      id: 'task-1',
      title: 'Обновить витрину десертов',
      assignee: 'Маша',
      points: 20,
      status: 'assigned',
      dueLabel: 'до 20:00',
    },
    {
      id: 'task-2',
      title: 'Промаркировать заготовки',
      assignee: 'Антон',
      points: 15,
      status: 'done',
      dueLabel: 'до конца смены',
      completedAt: now.toISOString(),
    },
    {
      id: 'task-3',
      title: 'Проверить кофе-зону',
      assignee: 'Илья',
      points: 10,
      status: 'accepted',
      dueLabel: 'сделано',
      completedAt: now.toISOString(),
      acceptedAt: now.toISOString(),
    },
  ],
  losses: {
    spoilage: 1200,
    staffMeal: 450,
    rd: 300,
    updatedAt: now.toISOString(),
  },
  handoffItems: [
    {
      id: 'handoff-1',
      area: 'kitchen',
      title: 'Соус том-ям на утро',
      criticality: 'high',
      checked: true,
      reason: 'Готово и промаркировано',
    },
    {
      id: 'handoff-2',
      area: 'kitchen',
      title: 'База для рамэна',
      criticality: 'medium',
      checked: false,
      reason: '',
    },
    {
      id: 'handoff-3',
      area: 'bar',
      title: 'Инвентарь сиропов',
      criticality: 'medium',
      checked: true,
      reason: 'Передано ночной смене',
    },
  ],
  requests: [
    {
      id: 'req-1',
      category: 'kitchen',
      item: 'Авокадо',
      remaining: '2 кг',
      needed: '8 кг',
      comment: 'Нужна поставка к утру',
      createdAt: now.toISOString(),
    },
  ],
  employees: [],
  loginEmployees: [],
  session: {
    bootstrapped: null,
    token: null,
    me: null,
  },
  revenueGoals: {
    weeklyRevenueTarget: 580000,
    monthlyRevenueTarget: 2450000,
    monthlyAverageCheckStart: 3200,
    monthlyAverageCheckTarget: 3600,
  },
  dailyBusinessMetrics: [
    {
      dateKey: localDateKeyAt(0),
      revenueActual: 78500,
      averageCheckTarget: 2350,
      averageCheckActual: 2210,
      updatedAt: now.toISOString(),
    },
    {
      dateKey: localDateKeyAt(-1),
      revenueActual: 72400,
      averageCheckTarget: 2250,
      averageCheckActual: 2310,
      updatedAt: isoAt(-1, 23, 35),
    },
    {
      dateKey: localDateKeyAt(-2),
      revenueActual: 69300,
      averageCheckTarget: 2200,
      averageCheckActual: 2180,
      updatedAt: isoAt(-2, 23, 10),
    },
  ],
  timeEntries: [
    {
      id: 'time-owner-1',
      userId: 'emp-owner-main',
      role: 'owner',
      startAt: isoAt(-3, 11, 20),
      endAt: isoAt(-3, 21, 10),
      earlyStart: false,
      earlyReason: null,
      createdAt: isoAt(-3, 11, 20),
    },
    {
      id: 'time-1',
      userId: 'emp-anton',
      role: 'chef',
      startAt: isoAt(0, 11, 25),
      endAt: isoAt(0, 19, 10),
      earlyStart: false,
      earlyReason: null,
      createdAt: isoAt(0, 11, 25),
    },
    {
      id: 'time-2',
      userId: 'emp-anton',
      role: 'chef',
      startAt: isoAt(-2, 10, 45),
      endAt: isoAt(-2, 20, 5),
      earlyStart: true,
      earlyReason: 'Ранний старт из-за поставки мяса',
      createdAt: isoAt(-2, 10, 45),
    },
    {
      id: 'time-3',
      userId: 'emp-masha',
      role: 'waiter',
      startAt: isoAt(0, 11, 20),
      endAt: isoAt(0, 22, 50),
      earlyStart: false,
      earlyReason: null,
      createdAt: isoAt(0, 11, 20),
    },
    {
      id: 'time-4',
      userId: 'emp-masha',
      role: 'waiter',
      startAt: isoAt(-4, 11, 20),
      endAt: isoAt(-4, 23, 20),
      earlyStart: false,
      earlyReason: null,
      createdAt: isoAt(-4, 11, 20),
    },
    {
      id: 'time-5',
      userId: 'emp-ilya',
      role: 'bartender',
      startAt: isoAt(-1, 11, 10),
      endAt: isoAt(-1, 23, 25),
      earlyStart: true,
      earlyReason: 'Подготовка бара к мероприятию',
      createdAt: isoAt(-1, 11, 10),
    },
    {
      id: 'time-6',
      userId: 'emp-ilya',
      role: 'bartender',
      startAt: isoAt(-6, 11, 30),
      endAt: isoAt(-6, 22, 45),
      earlyStart: false,
      earlyReason: null,
      createdAt: isoAt(-6, 11, 30),
    },
  ],
};
