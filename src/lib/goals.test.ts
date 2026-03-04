import {
  applyGoalTaskProgress,
  createEmptyGoalContributions,
  sanitizeGoalTasks,
} from './goals';
import type { GoalMetric, GoalTask } from '../types/domain';

describe('goals helpers', () => {
  it('increments progress, contribution, and metric value', () => {
    const task: GoalTask = {
      id: 'task-1',
      scope: 'global',
      title: 'Отзывы',
      department: 'waiters',
      points: 2,
      targetCount: 3,
      progressCount: 0,
      status: 'todo',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const metric: GoalMetric = {
      type: 'custom',
      unit: 'pts',
      targetValue: 20,
      currentValue: 0,
      label: 'Командный прогресс',
    };

    const result = applyGoalTaskProgress(
      [task],
      createEmptyGoalContributions(),
      metric,
      task.id,
      2,
      '2026-03-02T10:00:00.000Z',
    );

    expect(result.task?.progressCount).toBe(2);
    expect(result.task?.status).toBe('in_progress');
    expect(result.contributions.waiters.pointsEarned).toBe(4);
    expect(result.metric?.currentValue).toBe(4);
  });

  it('clamps count-based progress at target and marks task done', () => {
    const task: GoalTask = {
      id: 'task-2',
      scope: 'personal',
      employeeId: 'emp-1',
      title: 'Личная задача',
      department: 'bar',
      points: 3,
      targetCount: 1,
      progressCount: 0,
      status: 'todo',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const result = applyGoalTaskProgress(
      [task],
      createEmptyGoalContributions(),
      {
        type: 'custom',
        unit: 'pts',
        targetValue: 20,
        currentValue: 0,
        label: 'Командный прогресс',
      },
      task.id,
      10,
      '2026-03-02T10:00:00.000Z',
    );

    expect(result.task?.progressCount).toBe(1);
    expect(result.task?.status).toBe('done');
    expect(result.contributions.bar.pointsEarned).toBe(3);
  });

  it('drops legacy goal tasks with unsupported departments or roles', () => {
    const tasks = sanitizeGoalTasks([
      {
        id: 'legacy-hookah-role',
        scope: 'role',
        role: 'hookah' as never,
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
        department: 'hookah' as never,
        points: 1,
        status: 'todo',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'valid-task',
        scope: 'global',
        title: 'Актуальная задача',
        department: 'bar',
        points: 2,
        status: 'todo',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe('valid-task');
  });
});
