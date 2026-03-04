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
import type { Department, GoalTaskRole, GoalTaskScope } from '../types/domain';
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
const departmentOrder: Department[] = ['waiters', 'bar', 'kitchen'];
const departmentOptions: Department[] = ['waiters', 'bar', 'kitchen', 'other'];
const roleOptions: { value: GoalTaskRole; label: string }[] = [
  { value: 'waiter', label: 'Официант' },
  { value: 'bartender', label: 'Бармен' },
  { value: 'chef', label: 'Повар' },
  { value: 'owner', label: 'Основатель' },
];

export const GoalsScreen = () => {
  const currentEmployee = useAppStore(getCurrentEmployee);
  const goals = useAppStore((state) => state.goals);
  const goalsLoading = useAppStore((state) => state.goalsLoading);
  const goalsError = useAppStore((state) => state.goalsError);
  const goalsSyncDisabled = useAppStore((state) => state.goalsSyncDisabled);
  const loadGoals = useAppStore((state) => state.loadGoals);
  const completeTask = useAppStore((state) => state.completeTask);
  const setGoalPeriod = useAppStore((state) => state.setGoalPeriod);
  const createGoalTask = useAppStore((state) => state.createGoalTask);
  const deleteGoalTask = useAppStore((state) => state.deleteGoalTask);
  const loginEmployees = useAppStore((state) => state.loginEmployees);
  const refreshLoginEmployees = useAppStore((state) => state.refreshLoginEmployees);
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
  const [demoTitle, setDemoTitle] = useState('');
  const [demoDescription, setDemoDescription] = useState('');
  const [demoScope, setDemoScope] = useState<GoalTaskScope>('global');
  const [demoDepartment, setDemoDepartment] = useState<Department>('waiters');
  const [demoRole, setDemoRole] = useState<GoalTaskRole>('waiter');
  const [demoEmployeeId, setDemoEmployeeId] = useState('');
  const [demoPoints, setDemoPoints] = useState('1');
  const [demoTargetCount, setDemoTargetCount] = useState('1');
  const [savingDemoTask, setSavingDemoTask] = useState(false);
  const [deletingDemoTaskId, setDeletingDemoTaskId] = useState<string | null>(null);

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

  useEffect(() => {
    if (currentEmployee?.role === 'owner' && loginEmployees.length === 0) {
      void refreshLoginEmployees();
    }
  }, [currentEmployee?.role, loginEmployees.length, refreshLoginEmployees]);

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
  const demoTasks = useMemo(
    () =>
      goals.tasks
        .filter((task) => task.id.startsWith('goal-demo-'))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [goals.tasks],
  );
  const employeeOptions = useMemo(
    () => [...loginEmployees].sort((left, right) => left.fullName.localeCompare(right.fullName, 'ru')),
    [loginEmployees],
  );

  useEffect(() => {
    if (!demoEmployeeId && employeeOptions.length > 0) {
      setDemoEmployeeId(employeeOptions[0].id);
    }
  }, [demoEmployeeId, employeeOptions]);

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

  const saveDemoTask = async () => {
    setSavingDemoTask(true);
    const result = await createGoalTask({
      title: demoTitle,
      description: demoDescription,
      scope: demoScope,
      department: demoDepartment,
      points: Number(demoPoints) || 0,
      targetCount: Number(demoTargetCount) || 1,
      role: demoScope === 'role' ? demoRole : undefined,
      employeeId: demoScope === 'personal' ? demoEmployeeId : undefined,
    });
    setSavingDemoTask(false);

    if (!result.ok) {
      setToastMessage(result.reason ?? 'Не удалось создать demo-задачу');
      return;
    }

    setDemoTitle('');
    setDemoDescription('');
    setDemoScope('global');
    setDemoDepartment('waiters');
    setDemoRole('waiter');
    setDemoPoints('1');
    setDemoTargetCount('1');
    setToastMessage('Demo-задача создана');
  };

  const removeDemoTask = async (taskId: string) => {
    setDeletingDemoTaskId(taskId);
    const result = await deleteGoalTask(taskId);
    setDeletingDemoTaskId(null);

    if (!result.ok) {
      setToastMessage(result.reason ?? 'Не удалось удалить demo-задачу');
      return;
    }

    setToastMessage('Demo-задача удалена');
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
        <>
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

          <Card className="space-y-4">
            <SectionTitle title="Demo-задачи" />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Название"
                value={demoTitle}
                onChange={(event) => setDemoTitle(event.target.value)}
              />
              <Select
                value={demoScope}
                onChange={(event) => setDemoScope(event.target.value as GoalTaskScope)}
              >
                <option value="global">Общая</option>
                <option value="role">По должности</option>
                <option value="personal">Персональная</option>
              </Select>
            </div>
            <Input
              placeholder="Короткое описание"
              value={demoDescription}
              onChange={(event) => setDemoDescription(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={demoDepartment}
                onChange={(event) => setDemoDepartment(event.target.value as Department)}
              >
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {getGoalDepartmentLabel(department)}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min="1"
                placeholder="Очки"
                value={demoPoints}
                onChange={(event) => setDemoPoints(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min="1"
                placeholder="Цель по количеству"
                value={demoTargetCount}
                onChange={(event) => setDemoTargetCount(event.target.value)}
              />
              {demoScope === 'role' ? (
                <Select
                  value={demoRole}
                  onChange={(event) => setDemoRole(event.target.value as GoalTaskRole)}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : demoScope === 'personal' ? (
                <Select
                  value={demoEmployeeId}
                  onChange={(event) => setDemoEmployeeId(event.target.value)}
                >
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="rounded-2xl bg-fog px-4 py-3 text-sm text-ink/55">
                  Будет доступна всей команде
                </div>
              )}
            </div>
            <PrimaryButton
              disabled={savingDemoTask || goalsSyncDisabled}
              onClick={() => void saveDemoTask()}
            >
              {savingDemoTask ? 'Создаём…' : 'Добавить demo-задачу'}
            </PrimaryButton>

            <div className="space-y-2">
              {demoTasks.length > 0 ? (
                demoTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-fog p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{task.title}</p>
                      <p className="mt-1 text-xs text-ink/55">
                        {getGoalScopeLabel(task.scope)} · {getGoalDepartmentLabel(task.department)} · +
                        {task.points}
                      </p>
                    </div>
                    <SecondaryButton
                      disabled={deletingDemoTaskId === task.id}
                      onClick={() => void removeDemoTask(task.id)}
                    >
                      {deletingDemoTaskId === task.id ? 'Удаляем…' : 'Удалить'}
                    </SecondaryButton>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/55">Demo-задач пока нет.</p>
              )}
            </div>
          </Card>
        </>
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
