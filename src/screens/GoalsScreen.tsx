import { useEffect, useMemo, useState } from 'react';
import {
  createEmptyGoalContributions,
  getGoalCurrentValueLabel,
  getGoalDepartmentLabel,
  getGoalPeriodBadgeLabel,
  getGoalProgressPercent,
  getGoalScopeLabel,
  getGoalTargetValueLabel,
  getGoalTaskProgressLabel,
  getGoalTaskStatusLabel,
} from '../lib/goals';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';
import type { Department, GoalTaskScope } from '../types/domain';
import {
  Card,
  Input,
  Pill,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionTitle,
  Select,
} from '../components/ui';

const taskTabs: GoalTaskScope[] = ['global', 'role', 'personal'];
const departmentOrder: Department[] = ['waiters', 'bar', 'kitchen', 'hookah'];

export const GoalsScreen = () => {
  const currentEmployee = useAppStore(getCurrentEmployee);
  const goals = useAppStore((state) => state.goals);
  const goalsLoading = useAppStore((state) => state.goalsLoading);
  const goalsError = useAppStore((state) => state.goalsError);
  const goalsSyncDisabled = useAppStore((state) => state.goalsSyncDisabled);
  const loadGoals = useAppStore((state) => state.loadGoals);
  const completeTask = useAppStore((state) => state.completeTask);
  const setGoalPeriod = useAppStore((state) => state.setGoalPeriod);
  const [activeTab, setActiveTab] = useState<GoalTaskScope>('global');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<'week' | 'month'>(
    goals.activePeriod?.type ?? 'month',
  );
  const [targetValue, setTargetValue] = useState(
    goals.metric?.targetValue ? String(goals.metric.targetValue) : '120',
  );
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    if (currentEmployee?.id) {
      void loadGoals();
    }
  }, [currentEmployee?.id, loadGoals]);

  useEffect(() => {
    if (!goals.activePeriod) {
      return;
    }

    setPeriodType(goals.activePeriod.type);
  }, [goals.activePeriod]);

  useEffect(() => {
    if (!goals.metric?.targetValue) {
      return;
    }

    setTargetValue(String(goals.metric.targetValue));
  }, [goals.metric?.targetValue]);

  useEffect(() => {
    if (!goalsError) {
      return;
    }

    setToastMessage(goalsError);
  }, [goalsError]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const progressPercent = getGoalProgressPercent(goals.metric);
  const visibleTasks = useMemo(
    () => goals.tasks.filter((task) => task.scope === activeTab),
    [activeTab, goals.tasks],
  );
  const visibleContributions = useMemo(() => {
    const fallback = createEmptyGoalContributions();
    const source = goals.contributions ?? fallback;

    return departmentOrder.map((department) => source[department] ?? fallback[department]);
  }, [goals.contributions]);

  const completeVisibleTask = async (taskId: string, delta = 1) => {
    setBusyTaskId(taskId);
    const result = await completeTask(taskId, delta);
    setBusyTaskId(null);

    if (!result.ok) {
      setToastMessage(result.reason ?? 'Не удалось обновить задачу');
      return;
    }

    if (goalsSyncDisabled) {
      setToastMessage('Сохранили локально, синхронизация появится после восстановления связи.');
    }
  };

  const saveGoalSettings = async () => {
    const parsedTarget = Number(targetValue);
    setSavingGoal(true);
    const result = await setGoalPeriod({
      type: periodType,
      targetValue: parsedTarget,
      resetProgress: false,
    });
    setSavingGoal(false);

    if (!result.ok) {
      setToastMessage(result.reason ?? 'Не удалось обновить цель');
      return;
    }

    setToastMessage('Цель периода обновлена');
  };

  if (!currentEmployee) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink/55">Цель периода</p>
        <h1 className="font-display text-2xl font-semibold text-ink">
          {goals.metric?.label ?? 'Командный прогресс'}
        </h1>
      </div>

      {toastMessage ? (
        <Card className={goalsSyncDisabled ? 'bg-amber-50' : 'bg-white/90'}>
          <p className={`text-sm font-semibold ${goalsSyncDisabled ? 'text-amber-900' : 'text-pine'}`}>
            {toastMessage}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink/50">
              {goals.activePeriod ? getGoalPeriodBadgeLabel(goals.activePeriod.type) : 'Период'}
            </p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {goals.activePeriod?.title ?? 'Загрузка...'}
            </p>
          </div>
          <Pill>{progressPercent}%</Pill>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div>
            <p className="text-3xl font-semibold text-ink">
              {getGoalCurrentValueLabel(goals.metric)}
            </p>
            <p className="mt-1 text-sm text-ink/55">
              из {getGoalTargetValueLabel(goals.metric)}
            </p>
          </div>
          {goalsLoading ? <Pill>Обновляем</Pill> : null}
        </div>

        <ProgressBar value={progressPercent} label="Общий прогресс" />

        <div className="relative pt-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-2 rounded-full bg-fog" />
            ))}
          </div>
          <div
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${Math.max(progressPercent, 4)}%` }}
          >
            <div className="h-5 w-5 rounded-full bg-ink shadow-card ring-4 ring-white/80" />
          </div>
        </div>
      </Card>

      {currentEmployee.role === 'owner' ? (
        <Card className="space-y-3">
          <SectionTitle title="Настроить цель" />
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={periodType}
              onChange={(event) => setPeriodType(event.target.value as 'week' | 'month')}
            >
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
            </Select>
            <Input
              type="number"
              min="1"
              placeholder="Цель в баллах"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
            />
          </div>
          <PrimaryButton disabled={savingGoal} onClick={() => void saveGoalSettings()}>
            {savingGoal ? 'Сохраняем…' : 'Обновить цель'}
          </PrimaryButton>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <SectionTitle title="Вклад отделов" />
        <div className="space-y-3">
          {visibleContributions.map((item) => (
            <div key={item.department} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{getGoalDepartmentLabel(item.department)}</span>
                <span className="text-ink/55">{item.percent}%</span>
              </div>
              <div className="h-3 rounded-full bg-fog">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-clay to-citrus transition-all"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle title="Мои задачи" />
        <div className="grid grid-cols-3 gap-2">
          {taskTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                activeTab === tab ? 'bg-ink text-white' : 'bg-fog text-ink'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {getGoalScopeLabel(tab)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visibleTasks.length > 0 ? (
            visibleTasks.map((task) => {
              const isDone = task.status === 'done';
              const isCountTask = (task.targetCount ?? 1) > 1;

              return (
                <div key={task.id} className="rounded-2xl bg-fog p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{task.title}</p>
                      {task.description ? (
                        <p className="mt-2 text-sm text-ink/60">{task.description}</p>
                      ) : null}
                    </div>
                    <Pill
                      tone={
                        isDone ? 'success' : task.status === 'in_progress' ? 'warning' : 'default'
                      }
                    >
                      {getGoalTaskStatusLabel(task.status)}
                    </Pill>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink/55">+{task.points} очков</span>
                    <span className="font-semibold text-ink">{getGoalTaskProgressLabel(task)}</span>
                  </div>

                  <div className="mt-3">
                    {isCountTask ? (
                      <SecondaryButton
                        disabled={isDone || goalsSyncDisabled || busyTaskId === task.id}
                        onClick={() => void completeVisibleTask(task.id, 1)}
                      >
                        {isDone
                          ? 'Готово'
                          : busyTaskId === task.id
                            ? 'Обновляем…'
                            : 'Добавить +1'}
                      </SecondaryButton>
                    ) : (
                      <PrimaryButton
                        disabled={isDone || goalsSyncDisabled || busyTaskId === task.id}
                        onClick={() => void completeVisibleTask(task.id, 1)}
                      >
                        {isDone
                          ? 'Готово'
                          : busyTaskId === task.id
                            ? 'Обновляем…'
                            : 'Отметить выполнение'}
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-ink/55">
              Для этой вкладки задач пока нет. Прогресс периода все равно виден всей команде.
            </p>
          )}
        </div>
      </Card>

      <Card className="bg-clay/10">
        <p className="text-sm font-semibold text-ink">Как это влияет на цель</p>
        <p className="mt-2 text-sm text-ink/60">
          Каждое выполненное действие добавляет баллы в общую цель периода и в вклад отдела.
        </p>
      </Card>
    </div>
  );
};
