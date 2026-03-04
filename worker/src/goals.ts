export type Role = 'waiter' | 'bartender' | 'chef' | 'owner';
export type GoalPeriodType = 'week' | 'month';
export type GoalMetricType =
  | 'revenue'
  | 'avg_check'
  | 'guests'
  | 'reviews'
  | 'rating'
  | 'speed'
  | 'returning'
  | 'standards'
  | 'custom';
export type Department = 'waiters' | 'bar' | 'kitchen' | 'hookah' | 'other';
export type GoalTaskScope = 'global' | 'role' | 'personal';
export type GoalTaskStatus = 'todo' | 'in_progress' | 'done';
export type GoalTaskRole = Role | 'hookah';

export type GoalPeriod = {
  id: string;
  startAt: string;
  endAt: string;
  type: GoalPeriodType;
  title: string;
};

export type GoalMetric = {
  type: GoalMetricType;
  unit: string;
  targetValue: number;
  currentValue: number;
  label: string;
};

type GoalTaskBase = {
  id: string;
  title: string;
  description?: string;
  department: Department;
  points: number;
  targetCount?: number;
  progressCount?: number;
  status: GoalTaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  scope: GoalTaskScope;
};

export type GlobalTask = GoalTaskBase & {
  scope: 'global';
};

export type RoleTask = GoalTaskBase & {
  scope: 'role';
  role: GoalTaskRole;
};

export type PersonalTask = GoalTaskBase & {
  scope: 'personal';
  employeeId: string;
};

export type GoalTask = GlobalTask | RoleTask | PersonalTask;

export type GoalContribution = {
  department: Department;
  pointsEarned: number;
  percent: number;
  lastUpdatedAt: string | null;
};

export type GoalProgressMap = Record<
  string,
  {
    progressCount: number;
    status: GoalTaskStatus;
    updatedAt: string;
    completedAt?: string;
  }
>;

export const goalDepartments: Department[] = ['waiters', 'bar', 'kitchen', 'hookah', 'other'];

export const createEmptyGoalContributions = (
  lastUpdatedAt: string | null = null,
): Record<Department, GoalContribution> =>
  Object.fromEntries(
    goalDepartments.map((department) => [
      department,
      {
        department,
        pointsEarned: 0,
        percent: 0,
        lastUpdatedAt,
      },
    ]),
  ) as Record<Department, GoalContribution>;

export const normalizeGoalContributions = (
  contributions: Record<Department, GoalContribution>,
) => {
  const total = goalDepartments.reduce(
    (sum, department) => sum + (contributions[department]?.pointsEarned ?? 0),
    0,
  );

  return goalDepartments.reduce(
    (result, department) => {
      const current = contributions[department] ?? {
        department,
        pointsEarned: 0,
        percent: 0,
        lastUpdatedAt: null,
      };

      result[department] = {
        ...current,
        percent: total > 0 ? Math.round((current.pointsEarned / total) * 100) : 0,
      };

      return result;
    },
    createEmptyGoalContributions(),
  );
};

export const buildGoalPeriod = (
  type: GoalPeriodType,
  baseDate = new Date(),
  titleOverride?: string,
): GoalPeriod => {
  if (type === 'month') {
    const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 12, 0, 0, 0));
    const end = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    return {
      id: `goal-month-${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      type,
      title:
        titleOverride ??
        `${start.toLocaleString('ru-RU', { month: 'long', timeZone: 'UTC' })} ${start.getUTCFullYear()}`,
    };
  }

  const start = new Date(baseDate);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + diff);
  start.setUTCHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return {
    id: `goal-week-${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(
      start.getUTCDate(),
    ).padStart(2, '0')}`,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    type,
    title:
      titleOverride ??
      `Неделя ${start.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })}`,
  };
};

export const buildDefaultGoalMetric = (targetValue = 120): GoalMetric => ({
  type: 'custom',
  unit: 'pts',
  targetValue,
  currentValue: 0,
  label: 'Командный прогресс',
});

export const getDepartmentForRole = (role: GoalTaskRole): Department => {
  if (role === 'waiter') {
    return 'waiters';
  }

  if (role === 'bartender') {
    return 'bar';
  }

  if (role === 'chef') {
    return 'kitchen';
  }

  if (role === 'hookah') {
    return 'hookah';
  }

  return 'other';
};

export const createDefaultGoalTasks = (nowIso: string): GoalTask[] => [
  {
    id: 'goal-global-reviews',
    scope: 'global',
    title: 'Отзывы гостей',
    description: 'Собираем живые отзывы, чтобы ускорить общий прогресс периода.',
    department: 'waiters',
    points: 1,
    targetCount: 12,
    progressCount: 4,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-global-cocktail',
    scope: 'global',
    title: 'Коктейль недели',
    description: 'Каждая продажа продвигает общую цель ресторана.',
    department: 'bar',
    points: 2,
    targetCount: 8,
    progressCount: 2,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-global-dessert',
    scope: 'global',
    title: 'Десерт дня',
    description: 'Подсвечиваем десерт в рекомендациях гостям.',
    department: 'waiters',
    points: 1,
    targetCount: 10,
    progressCount: 2,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-global-new-dish',
    scope: 'global',
    title: 'Новая подача',
    description: 'Кухня подтверждает стабильный выход новой позиции.',
    department: 'kitchen',
    points: 2,
    targetCount: 5,
    progressCount: 1,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-role-waiter-upsell',
    scope: 'role',
    role: 'waiter',
    title: 'Апселл на десерт',
    description: 'Каждые продажи десертов добавляют баллы залу.',
    department: 'waiters',
    points: 1,
    targetCount: 5,
    progressCount: 1,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-role-bartender-signature',
    scope: 'role',
    role: 'bartender',
    title: 'Фирменный коктейль',
    description: 'Продвигаем авторский напиток недели.',
    department: 'bar',
    points: 2,
    targetCount: 4,
    progressCount: 1,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-role-chef-standard',
    scope: 'role',
    role: 'chef',
    title: 'Стабильный выход блюда',
    description: 'Каждый подтвержденный прогон приносит баллы кухне.',
    department: 'kitchen',
    points: 2,
    targetCount: 3,
    progressCount: 1,
    status: 'in_progress',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'goal-role-hookah-special',
    scope: 'role',
    role: 'hookah',
    title: 'Авторский кальян',
    description: 'Спец-задача для кальянного направления.',
    department: 'hookah',
    points: 3,
    targetCount: 3,
    progressCount: 0,
    status: 'todo',
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

export const createDefaultPersonalTask = (
  employeeId: string,
  role: Role,
  nowIso: string,
): PersonalTask => ({
  id: `goal-personal-${employeeId}`,
  scope: 'personal',
  employeeId,
  title:
    role === 'waiter'
      ? 'Личный фокус на гостях'
      : role === 'bartender'
        ? 'Чистый бар без хвостов'
        : role === 'chef'
          ? 'Темп кухни без возвратов'
          : 'Личный контроль точки',
  description:
    role === 'waiter'
      ? 'Соберите личный мини-результат по заботе о гостях.'
      : role === 'bartender'
        ? 'Закройте смену без возвратов по барному чек-листу.'
        : role === 'chef'
          ? 'Проведите смену без возвратов по качеству.'
          : 'Закройте личную управленческую задачу периода.',
  department: getDepartmentForRole(role),
  points: role === 'owner' ? 4 : 3,
  targetCount: 1,
  progressCount: 0,
  status: 'todo',
  createdAt: nowIso,
  updatedAt: nowIso,
});

export const buildInitialProgressMap = (tasks: GoalTask[]): GoalProgressMap =>
  tasks.reduce<GoalProgressMap>((result, task) => {
    result[task.id] = {
      progressCount: task.progressCount ?? 0,
      status: task.status,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
    };

    return result;
  }, {});

export const buildContributionsFromTasks = (tasks: GoalTask[]) =>
  normalizeGoalContributions(
    tasks.reduce<Record<Department, GoalContribution>>((result, task) => {
      const progressCount = task.progressCount ?? 0;
      const pointsEarned = progressCount * task.points;

      result[task.department] = {
        department: task.department,
        pointsEarned: (result[task.department]?.pointsEarned ?? 0) + pointsEarned,
        percent: 0,
        lastUpdatedAt: pointsEarned > 0 ? task.updatedAt : result[task.department]?.lastUpdatedAt ?? null,
      };

      return result;
    }, createEmptyGoalContributions()),
  );

export const getMetricCurrentValue = (contributions: Record<Department, GoalContribution>) =>
  goalDepartments.reduce(
    (sum, department) => sum + (contributions[department]?.pointsEarned ?? 0),
    0,
  );

export const mergeGoalTasksWithProgress = (
  tasks: GoalTask[],
  progressMap: GoalProgressMap,
): GoalTask[] =>
  tasks.map((task) => {
    const progress = progressMap[task.id];

    return progress
      ? {
          ...task,
          progressCount: progress.progressCount,
          status: progress.status,
          updatedAt: progress.updatedAt,
          completedAt: progress.completedAt,
        }
      : task;
  });

export const getVisibleGoalTasks = (
  tasks: GoalTask[],
  session: { employeeId: string; role: Role },
) =>
  tasks.filter((task) => {
    if (task.scope === 'global') {
      return true;
    }

    if (task.scope === 'role') {
      return task.role === session.role;
    }

    return task.employeeId === session.employeeId;
  });

const clampDelta = (delta: number) => Math.max(1, Math.min(Math.trunc(delta || 1), 10));

export const applyTaskProgress = (
  task: GoalTask,
  progressMap: GoalProgressMap,
  contributions: Record<Department, GoalContribution>,
  delta: number,
  updatedAt: string,
) => {
  const targetCount = task.targetCount && task.targetCount > 0 ? task.targetCount : 1;
  const currentProgress = progressMap[task.id]?.progressCount ?? task.progressCount ?? 0;

  if (currentProgress >= targetCount) {
    return {
      progressMap,
      contributions,
      task: {
        ...task,
        progressCount: currentProgress,
        status: 'done' as GoalTaskStatus,
      },
      pointsAdded: 0,
    };
  }

  const safeDelta = clampDelta(delta);
  const nextProgress = Math.min(currentProgress + safeDelta, targetCount);
  const appliedDelta = nextProgress - currentProgress;
  const pointsAdded = appliedDelta * task.points;
  const status: GoalTaskStatus =
    nextProgress >= targetCount ? 'done' : nextProgress > 0 ? 'in_progress' : 'todo';

  const nextProgressMap: GoalProgressMap = {
    ...progressMap,
    [task.id]: {
      progressCount: nextProgress,
      status,
      updatedAt,
      completedAt: status === 'done' ? updatedAt : undefined,
    },
  };

  const nextContributions = normalizeGoalContributions({
    ...contributions,
    [task.department]: {
      ...(contributions[task.department] ?? {
        department: task.department,
        pointsEarned: 0,
        percent: 0,
        lastUpdatedAt: null,
      }),
      department: task.department,
      pointsEarned: (contributions[task.department]?.pointsEarned ?? 0) + pointsAdded,
      lastUpdatedAt: updatedAt,
    },
  });

  return {
    progressMap: nextProgressMap,
    contributions: nextContributions,
    task: {
      ...task,
      progressCount: nextProgress,
      status,
      updatedAt,
      completedAt: status === 'done' ? updatedAt : undefined,
    },
    pointsAdded,
  };
};
