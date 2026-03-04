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

const formatMetricValue = (value: number) => Math.round(value).toLocaleString('ru-RU');

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
  const actualAverageCheckValues = currentMonthMetrics
    .map((metric) => metric.averageCheckActual)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const averageCheckStart = revenueGoals.monthlyAverageCheckStart ?? 3200;
  const averageCheckTarget = revenueGoals.monthlyAverageCheckTarget ?? averageCheckStart;
  const averageCheckDelta = Math.max(Math.abs(averageCheckTarget - averageCheckStart), 200);
  const averageCheckMin = Math.max(averageCheckStart - averageCheckDelta, 0);
  const averageCheckMax = averageCheckStart + averageCheckDelta;
  const currentAverageCheck =
    actualAverageCheckValues.length > 0
      ? actualAverageCheckValues.reduce((sum, value) => sum + value, 0) /
        actualAverageCheckValues.length
      : averageCheckStart;
  const averageCheckThumbRatio = clamp(
    (currentAverageCheck - averageCheckMin) / Math.max(averageCheckMax - averageCheckMin, 1),
    0,
    1,
  );
  const averageCheckFillWidth = Math.max(averageCheckThumbRatio * 100, 0);
  const averageCheckBaseRatio = clamp(
    (averageCheckStart - averageCheckMin) / Math.max(averageCheckMax - averageCheckMin, 1),
    0,
    1,
  );
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
            <div className="mt-5">
              <div className="relative px-1 pt-8">
                <div className="h-3 rounded-full bg-white/75" />
                <div
                  className="absolute left-1 top-8 h-3 rounded-full bg-gradient-to-r from-clay to-citrus"
                  style={{ width: `${averageCheckFillWidth}%` }}
                />
                <div
                  className="absolute top-5 h-9 w-px bg-ink/25"
                  style={{ left: `${averageCheckBaseRatio * 100}%` }}
                />
                <div
                  className="absolute top-0 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-card"
                  style={{ left: `${averageCheckBaseRatio * 100}%` }}
                >
                  {formatMetricValue(averageCheckStart)}
                </div>
                <div
                  className="absolute top-4 -translate-x-1/2"
                  style={{ left: `${averageCheckThumbRatio * 100}%` }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink shadow-card ring-4 ring-white/80">
                    <div className="h-2.5 w-2.5 rounded-full bg-citrus" />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-xs font-semibold text-ink/45">
                <span>{formatMetricValue(averageCheckMin)}</span>
                <span>{formatMetricValue(averageCheckTarget)}</span>
              </div>
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
