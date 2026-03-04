import type {
  Department,
  Employee,
  GoalContribution,
  GoalMetric,
  GoalPeriod,
  GoalPeriodType,
  GoalTask,
  GoalTaskScope,
  GoalTaskStatus,
  TeamDepartment,
} from '../types/domain';

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

export const getGoalDepartmentLabel = (department: Department) => {
  const labels: Record<Department, string> = {
    waiters: 'Официанты',
    bar: 'Бар',
    kitchen: 'Кухня',
    hookah: 'Кальян',
    other: 'Общее',
  };

  return labels[department];
};

export const getGoalScopeLabel = (scope: GoalTaskScope) => {
  const labels: Record<GoalTaskScope, string> = {
    global: 'Общие',
    role: 'По должности',
    personal: 'Персональные',
  };

  return labels[scope];
};

export const getGoalTaskStatusLabel = (status: GoalTaskStatus) => {
  const labels: Record<GoalTaskStatus, string> = {
    todo: 'Новая',
    in_progress: 'В процессе',
    done: 'Готово',
  };

  return labels[status];
};

export const getGoalPeriodBadgeLabel = (periodType: GoalPeriodType) =>
  periodType === 'month' ? 'Месяц' : 'Неделя';

export const getGoalProgressPercent = (metric: GoalMetric | null) => {
  if (!metric || metric.targetValue <= 0) {
    return 0;
  }

  return Math.min(Math.round((metric.currentValue / metric.targetValue) * 100), 100);
};

export const getGoalCurrentValueLabel = (metric: GoalMetric | null) => {
  if (!metric) {
    return '0';
  }

  return `${metric.currentValue.toLocaleString('ru-RU')} ${metric.unit}`;
};

export const getGoalTargetValueLabel = (metric: GoalMetric | null) => {
  if (!metric) {
    return '0';
  }

  return `${metric.targetValue.toLocaleString('ru-RU')} ${metric.unit}`;
};

export const mapTeamDepartmentToGoalDepartment = (department: TeamDepartment): Department => {
  if (department === 'hall') {
    return 'waiters';
  }

  if (department === 'bar') {
    return 'bar';
  }

  if (department === 'kitchen') {
    return 'kitchen';
  }

  return 'other';
};

export const getGoalDepartmentForEmployee = (employee: Employee | null): Department => {
  if (!employee) {
    return 'other';
  }

  return mapTeamDepartmentToGoalDepartment(employee.department);
};

const clampDelta = (delta: number) => Math.max(1, Math.min(Math.trunc(delta || 1), 10));

const normalizeTaskStatus = (progressCount: number, targetCount: number): GoalTaskStatus => {
  if (progressCount >= targetCount) {
    return 'done';
  }

  if (progressCount > 0) {
    return 'in_progress';
  }

  return 'todo';
};

export const normalizeGoalContributions = (
  contributions: Record<Department, GoalContribution>,
): Record<Department, GoalContribution> => {
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

export const applyGoalTaskProgress = (
  tasks: GoalTask[],
  contributions: Record<Department, GoalContribution>,
  metric: GoalMetric | null,
  taskId: string,
  delta = 1,
  updatedAt = new Date().toISOString(),
) => {
  const currentTask = tasks.find((task) => task.id === taskId) ?? null;

  if (!currentTask) {
    return {
      tasks,
      contributions,
      metric,
      task: null,
      pointsAdded: 0,
    };
  }

  const targetCount = currentTask.targetCount && currentTask.targetCount > 0 ? currentTask.targetCount : 1;
  const currentProgress = currentTask.progressCount ?? 0;

  if (currentProgress >= targetCount) {
    return {
      tasks,
      contributions,
      metric,
      task: currentTask,
      pointsAdded: 0,
    };
  }

  const safeDelta = clampDelta(delta);
  const nextProgress = Math.min(currentProgress + safeDelta, targetCount);
  const appliedDelta = nextProgress - currentProgress;
  const pointsAdded = appliedDelta * currentTask.points;
  const nextStatus = normalizeTaskStatus(nextProgress, targetCount);

  const nextTask: GoalTask = {
    ...currentTask,
    progressCount: nextProgress,
    status: nextStatus,
    updatedAt,
    completedAt: nextStatus === 'done' ? updatedAt : undefined,
  };

  const nextTasks = tasks.map((task) => (task.id === taskId ? nextTask : task));
  const nextContributions = normalizeGoalContributions({
    ...contributions,
    [currentTask.department]: {
      ...(contributions[currentTask.department] ?? {
        department: currentTask.department,
        pointsEarned: 0,
        percent: 0,
        lastUpdatedAt: null,
      }),
      department: currentTask.department,
      pointsEarned:
        (contributions[currentTask.department]?.pointsEarned ?? 0) + pointsAdded,
      lastUpdatedAt: updatedAt,
    },
  });

  const nextMetric = metric
    ? {
        ...metric,
        // MVP choice: overall progress is point-based, so each task step adds points directly
        // into metric.currentValue instead of mapping tasks to revenue.
        currentValue: metric.currentValue + pointsAdded,
      }
    : null;

  return {
    tasks: nextTasks,
    contributions: nextContributions,
    metric: nextMetric,
    task: nextTask,
    pointsAdded,
  };
};

export const getGoalTaskProgressLabel = (task: GoalTask) => {
  const targetCount = task.targetCount && task.targetCount > 0 ? task.targetCount : 1;
  const progressCount = task.progressCount ?? 0;

  return `${Math.min(progressCount, targetCount)}/${targetCount}`;
};

export const getGoalVisibleTasksByScope = (tasks: GoalTask[], scope: GoalTaskScope) =>
  tasks.filter((task) => task.scope === scope);

export const createGoalPeriod = (
  periodType: GoalPeriodType,
  baseDate = new Date(),
): GoalPeriod => {
  const date = new Date(baseDate);

  if (periodType === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      id: `goal-month-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      type: 'month',
      title: `${start.toLocaleString('ru-RU', { month: 'long' })} ${start.getFullYear()}`,
    };
  }

  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(12, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    id: `goal-week-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
      start.getDate(),
    ).padStart(2, '0')}`,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    type: 'week',
    title: `Неделя ${start.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })}`,
  };
};
