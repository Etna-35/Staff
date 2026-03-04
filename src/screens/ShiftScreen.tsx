import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appLinks } from '../config/links';
import { initTelegramApp, getTelegramDisplayName } from '../lib/telegram';
import { durationHours, formatDuration, isBeforeShiftStart } from '../lib/timeTracking';
import {
  getDailyBusinessMetricsForPeriod,
  getCurrentActiveEntry,
  getCurrentEmployee,
  getRevenueActualForPeriod,
  getVisibleStageKeys,
  useAppStore,
} from '../store/useAppStore';
import {
  Card,
  InlineLink,
  Input,
  Pill,
  PrimaryButton,
  ProgressBar,
  SectionTitle,
  ShellHeader,
} from '../components/ui';

const stageMeta: Record<
  'leftovers' | 'losses' | 'handoff' | 'closingPhotos',
  { title: string; description: string; href?: string }
> = {
  leftovers: {
    title: 'Остатки',
    description: 'Короткая отметка после пересчета.',
  },
  losses: {
    title: 'Потери',
    description: 'Порча, стафф и R&D.',
    href: '/shift/losses',
  },
  handoff: {
    title: 'Передача',
    description: 'Кухня и бар на следующее утро.',
    href: '/shift/handoff',
  },
  closingPhotos: {
    title: 'Фото закрытия',
    description: 'Пока как ссылка и подтверждение.',
  },
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getMonthProgressRatio = (now = new Date()) => {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (daysInMonth <= 1) {
    return 1;
  }

  return clamp((now.getDate() - 1) / (daysInMonth - 1), 0.08, 0.92);
};

const getTrajectoryPath = ({
  startValue,
  currentValue,
  targetValue,
  progressRatio,
}: {
  startValue: number;
  currentValue: number;
  targetValue: number;
  progressRatio: number;
}) => {
  const width = 100;
  const height = 56;
  const paddingX = 2;
  const paddingY = 4;
  const minValue = Math.min(startValue, currentValue, targetValue) * 0.92;
  const maxValue = Math.max(startValue, currentValue, targetValue) * 1.08;
  const range = maxValue - minValue || 1;
  const toY = (value: number) =>
    clamp(
      height - paddingY - ((value - minValue) / range) * (height - paddingY * 2),
      paddingY,
      height - paddingY,
    );

  const startX = paddingX;
  const currentX = paddingX + (width - paddingX * 2) * progressRatio;
  const endX = width - paddingX;
  const startY = toY(startValue);
  const currentY = toY(currentValue);
  const endY = toY(targetValue);
  const controlOneX = startX + (currentX - startX) * 0.5;
  const controlTwoX = currentX + (endX - currentX) * 0.45;

  return `M ${startX} ${startY}
    C ${controlOneX} ${startY} ${currentX - 8} ${currentY + 2} ${currentX} ${currentY}
    S ${controlTwoX} ${endY} ${endX} ${endY}`;
};

export const ShiftScreen = () => {
  const {
    telegramName,
    setTelegramName,
    shift,
    losses,
    dailyBusinessMetrics,
    handoffItems,
    completeStage,
    revenueGoals,
    startTimeEntry,
    endCurrentTimeEntry,
    tasks,
  } = useAppStore();
  const currentEmployee = useAppStore(getCurrentEmployee);
  const activeEntry = useAppStore(getCurrentActiveEntry);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showEarlyStartModal, setShowEarlyStartModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [shortShiftPrompt, setShortShiftPrompt] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    initTelegramApp();
    setTelegramName(getTelegramDisplayName());
  }, [setTelegramName]);

  const stages = useMemo(() => {
    const handoffComplete = handoffItems.every((item) => item.checked && item.reason.trim());
    const visibleKeys = getVisibleStageKeys(currentEmployee?.role ?? null);

    const allStages: { key: 'leftovers' | 'losses' | 'handoff' | 'closingPhotos'; done: boolean }[] = [
      {
        key: 'leftovers',
        done: shift.leftoversChecked,
      },
      {
        key: 'losses',
        done: Boolean(losses.updatedAt),
      },
      {
        key: 'handoff',
        done: handoffComplete,
      },
      {
        key: 'closingPhotos',
        done: shift.closingPhotosChecked,
      },
    ];

    return allStages.filter((stage) => visibleKeys.includes(stage.key));
  }, [
    currentEmployee?.role,
    handoffItems,
    losses.updatedAt,
    shift.closingPhotosChecked,
    shift.leftoversChecked,
  ]);

  const completedCount = stages.filter((stage) => stage.done).length;
  const progress = Math.round((completedCount / stages.length) * 100);
  const normalizeAssignee = (value: string) => value.trim().toLocaleLowerCase('ru-RU');
  const myTasks = currentEmployee
    ? tasks.filter(
        (task) => normalizeAssignee(task.assignee) === normalizeAssignee(currentEmployee.fullName),
      )
    : [];
  const acceptedTasksCount = myTasks.filter((task) => task.status === 'accepted').length;
  const workedNowLabel = activeEntry
    ? formatDuration(durationHours(activeEntry.startAt, null))
    : null;
  const weeklyRevenueActual = getRevenueActualForPeriod(dailyBusinessMetrics, 'week');
  const monthlyRevenueActual = getRevenueActualForPeriod(dailyBusinessMetrics, 'month');
  const showRevenueValues = currentEmployee?.role === 'owner';
  const currentMonthMetrics = getDailyBusinessMetricsForPeriod(dailyBusinessMetrics, 'month');
  const averageCheckProgressRatio = getMonthProgressRatio(new Date());
  const actualAverageCheckValues = currentMonthMetrics
    .map((metric) => metric.averageCheckActual)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const averageCheckStart = revenueGoals.monthlyAverageCheckStart ?? 3200;
  const averageCheckTarget = revenueGoals.monthlyAverageCheckTarget ?? averageCheckStart;
  const currentAverageCheck =
    actualAverageCheckValues.length > 0
      ? actualAverageCheckValues.reduce((sum, value) => sum + value, 0) /
        actualAverageCheckValues.length
      : averageCheckStart;
  const averageCheckPath = getTrajectoryPath({
    startValue: averageCheckStart,
    currentValue: currentAverageCheck,
    targetValue: averageCheckTarget,
    progressRatio: averageCheckProgressRatio,
  });
  const weeklyRevenueProgress = revenueGoals.weeklyRevenueTarget
    ? Math.min(Math.round((weeklyRevenueActual / revenueGoals.weeklyRevenueTarget) * 100), 100)
    : 0;
  const monthlyRevenueProgress = revenueGoals.monthlyRevenueTarget
    ? Math.min(Math.round((monthlyRevenueActual / revenueGoals.monthlyRevenueTarget) * 100), 100)
    : 0;

  const onStartShift = () => {
    setEntryError(null);

    if (isBeforeShiftStart(new Date())) {
      setShowEarlyStartModal(true);
      return;
    }

    const result = startTimeEntry();
    if (!result.ok) {
      setEntryError(result.reason ?? 'Не удалось открыть смену');
    }
  };

  const confirmEarlyStart = () => {
    const result = startTimeEntry({ earlyReason });

    if (!result.ok) {
      setEntryError(result.reason ?? 'Не удалось открыть смену');
      return;
    }

    setEarlyReason('');
    setShowEarlyStartModal(false);
  };

  const onEndShift = (force = false) => {
    const result = endCurrentTimeEntry({ force });

    if (result.requiresConfirmation) {
      setShortShiftPrompt(true);
      return;
    }

    if (!result.ok) {
      setEntryError(result.reason ?? 'Не удалось закрыть смену');
      return;
    }

    setShortShiftPrompt(false);
  };

  return (
    <div className="space-y-4 pt-3">
      <ShellHeader
        name={currentEmployee?.fullName ?? telegramName}
        action={
          activeEntry ? (
            <button
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-ink"
              onClick={() => onEndShift()}
            >
              Закончить смену
            </button>
          ) : (
            <button
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-ink"
              onClick={onStartShift}
            >
              Начать смену
            </button>
          )
        }
      />

      {activeEntry ? (
        <Card className="bg-clay/10">
          <p className="font-semibold text-ink">Смена открыта</p>
          <p className="mt-1 text-sm text-ink/60">
            Идет {workedNowLabel} · старт{' '}
            {new Date(activeEntry.startAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </Card>
      ) : null}

      {entryError ? (
        <Card className="bg-red-50">
          <p className="text-sm font-semibold text-red-700">{entryError}</p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <SectionTitle title="План ресторана" />
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">Неделя по выручке</span>
              {showRevenueValues ? (
                <span className="text-ink/60">
                  {revenueGoals.weeklyRevenueTarget
                    ? `${weeklyRevenueActual.toLocaleString('ru-RU')} / ${revenueGoals.weeklyRevenueTarget.toLocaleString('ru-RU')} ₽`
                    : 'План не задан'}
                </span>
              ) : null}
            </div>
            <ProgressBar value={weeklyRevenueProgress} hideHeader />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">Месяц по выручке</span>
              {showRevenueValues ? (
                <span className="text-ink/60">
                  {revenueGoals.monthlyRevenueTarget
                    ? `${monthlyRevenueActual.toLocaleString('ru-RU')} / ${revenueGoals.monthlyRevenueTarget.toLocaleString('ru-RU')} ₽`
                    : 'План не задан'}
                </span>
              ) : null}
            </div>
            <ProgressBar value={monthlyRevenueProgress} hideHeader />
          </div>
          <div className="rounded-2xl bg-fog p-4">
            <p className="text-xs text-ink/50">План среднего чека за месяц</p>
            <div className="relative mt-4 h-28 overflow-hidden rounded-[1.5rem] bg-[#efe9da]">
              <div className="absolute inset-x-4 bottom-5 flex items-end gap-3 opacity-75">
                <div className="h-16 flex-1 rounded-t-[1.6rem] bg-white/70" />
                <div className="h-10 flex-1 rounded-t-[1.6rem] bg-white/70" />
                <div className="h-6 flex-1 rounded-full bg-white/70" />
                <div className="h-6 flex-1 rounded-full bg-white/70" />
                <div className="h-6 flex-1 rounded-full bg-white/70" />
              </div>
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 56"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={averageCheckPath}
                  fill="none"
                  stroke="#e65e1c"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 bg-gradient-to-br from-white to-[#fff5dd]">
        <ProgressBar value={shift.closedAt ? 100 : progress} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Этапы</p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {completedCount}/{stages.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Задачи</p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {acceptedTasksCount}/{myTasks.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Командный зачот</p>
            <p className="mt-1 text-xl font-semibold text-ink">Скоро</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Личный зачот</p>
            <p className="mt-1 text-xl font-semibold text-ink">Скоро</p>
          </div>
        </div>
      </Card>

      <div>
        <SectionTitle title="Этапы" />
        <div className="space-y-3">
          {stages.map((stage) => {
            const meta = stageMeta[stage.key];
            const statusIcon = stage.done ? '✅' : stage.key === 'losses' ? '🟡' : '⬜';

            return (
              <Card key={stage.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{statusIcon}</span>
                    <h3 className="font-semibold">{meta.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{meta.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {meta.href ? (
                    <Link
                      to={meta.href}
                      className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold"
                    >
                      Открыть
                    </Link>
                  ) : null}
                  {stage.key === 'leftovers' ? (
                    <button
                      className="rounded-2xl bg-ink px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => completeStage('leftovers')}
                    >
                      Готово
                    </button>
                  ) : null}
                  {stage.key === 'closingPhotos' ? (
                    <button
                      className="rounded-2xl bg-ink px-3 py-2 text-sm font-semibold text-white"
                      onClick={() => setShowPhotos(true)}
                    >
                      Фото
                    </button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <SectionTitle title="Быстрые ссылки" />
        <div className="space-y-2 text-sm text-ink/75">
          <a
            href={appLinks.taskChatUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-fog px-4 py-3"
          >
            Чат задач
          </a>
          <a
            href={appLinks.knowledgeBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-fog px-4 py-3"
          >
            База знаний
          </a>
        </div>
      </Card>

      {showPhotos ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Фото закрытия</h3>
              <Pill tone="warning">MVP</Pill>
            </div>
            <p className="text-sm text-ink/65">
              В этом этапе пока храним только инструкцию и ручное подтверждение без загрузки
              файлов.
            </p>
            <a
              href={appLinks.closePhotoGuideUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block rounded-2xl bg-fog px-4 py-3 text-sm font-semibold"
            >
              Открыть чеклист фото
            </a>
            <div className="mt-4 flex gap-3">
              <PrimaryButton
                onClick={() => {
                  completeStage('closingPhotos');
                  setShowPhotos(false);
                }}
              >
                Подтвердить
              </PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => setShowPhotos(false)}
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEarlyStartModal ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <h3 className="text-lg font-semibold">Ранний старт</h3>
            <p className="mt-2 text-sm text-ink/60">
              До 11:20 смену можно открыть только с причиной.
            </p>
            <Input
              className="mt-4"
              placeholder="Почему открываете смену раньше?"
              value={earlyReason}
              onChange={(event) => setEarlyReason(event.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <PrimaryButton disabled={!earlyReason.trim()} onClick={confirmEarlyStart}>
                Открыть с причиной
              </PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  setShowEarlyStartModal(false);
                  setEarlyReason('');
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shortShiftPrompt ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <h3 className="text-lg font-semibold">Случайно?</h3>
            <p className="mt-2 text-sm text-ink/60">
              Смена длится меньше 15 минут. Подтвердите закрытие только если это не мисклик.
            </p>
            <div className="mt-4 flex gap-3">
              <PrimaryButton onClick={() => onEndShift(true)}>Да, закрыть</PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => setShortShiftPrompt(false)}
              >
                Вернуться
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <InlineLink to="/missions">Перейти к задачам</InlineLink>
    </div>
  );
};
