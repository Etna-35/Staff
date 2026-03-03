import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appLinks } from '../config/links';
import { initTelegramApp, getTelegramDisplayName } from '../lib/telegram';
import { durationHours, formatDuration, isBeforeShiftStart } from '../lib/timeTracking';
import {
  getCurrentActiveEntry,
  getCurrentEmployee,
  getEntriesForPeriod,
  getEntriesHours,
  getNormalShiftLabel,
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
  SecondaryButton,
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

export const ShiftScreen = () => {
  const {
    telegramName,
    setTelegramName,
    shift,
    losses,
    timeEntries,
    handoffItems,
    completeStage,
    closeShift,
    startTimeEntry,
    endCurrentTimeEntry,
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
  const canClose = completedCount === stages.length && !shift.closedAt;
  const myEntries = timeEntries.filter((entry) => entry.userId === currentEmployee?.id);
  const weeklyHours = getEntriesHours(getEntriesForPeriod(myEntries, 'week'));
  const monthlyHours = getEntriesHours(getEntriesForPeriod(myEntries, 'month'));
  const workedNowLabel = activeEntry
    ? formatDuration(durationHours(activeEntry.startAt, null))
    : null;

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
        subtitle={currentEmployee?.positionTitle ?? 'Сотрудник'}
      />

      <Card>
        <SectionTitle
          title="Табель"
          action={
            <Link className="text-sm font-semibold text-clay" to="/profile/timesheet">
              Открыть
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/45">Неделя</p>
            <p className="mt-2 text-xl font-semibold">{weeklyHours.toFixed(1)} ч</p>
          </div>
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/45">Месяц</p>
            <p className="mt-2 text-xl font-semibold">{monthlyHours.toFixed(1)} ч</p>
          </div>
        </div>
        {activeEntry ? (
          <div className="mt-4 rounded-2xl border border-clay/30 bg-clay/10 p-4">
            <p className="font-semibold text-ink">У вас открыта смена</p>
            <p className="mt-1 text-sm text-ink/60">
              Идет {workedNowLabel} · старт{' '}
              {new Date(activeEntry.startAt).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="mt-3 flex gap-3">
              <PrimaryButton className="flex-1" onClick={() => onEndShift()}>
                Закрыть сейчас
              </PrimaryButton>
              <SecondaryButton className="flex-1" onClick={() => setEntryError(null)}>
                Продолжить
              </SecondaryButton>
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white/80 p-4">
            <p className="text-xs text-ink/45">График</p>
            <p className="mt-2 text-lg font-semibold">{getNormalShiftLabel()}</p>
          </div>
          {activeEntry ? (
            <PrimaryButton onClick={() => onEndShift()}>Закончить смену</PrimaryButton>
          ) : (
            <PrimaryButton onClick={onStartShift}>Начать смену</PrimaryButton>
          )}
          {entryError ? <p className="text-sm text-red-700">{entryError}</p> : null}
        </div>
      </Card>

      <Card className="space-y-4 bg-gradient-to-br from-white to-[#fff5dd]">
        <ProgressBar value={shift.closedAt ? 100 : progress} />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Этапов закрыто</p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {completedCount}/{stages.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-ink/55">Статус</p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {shift.closedAt ? 'Смена закрыта' : 'В процессе'}
            </p>
          </div>
        </div>
        <PrimaryButton disabled={!canClose} onClick={closeShift}>
          {shift.closedAt ? 'Смена закрыта' : 'Закрыть смену'}
        </PrimaryButton>
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
