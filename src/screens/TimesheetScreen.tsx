import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calcEarnings,
  durationHours,
  formatClock,
  formatDayLabel,
  formatDuration,
  getPeriodEntries,
  isSameDay,
} from '../lib/timeTracking';
import {
  getCurrentActiveEntry,
  getCurrentEmployee,
  getProfileRate,
  useAppStore,
} from '../store/useAppStore';
import type { TimesheetPeriod } from '../types/domain';
import { Card, Pill, PrimaryButton, SectionTitle, SecondaryButton } from '../components/ui';

const periodLabels: Record<Exclude<TimesheetPeriod, 'day'>, string> = {
  week: 'Неделя',
  month: 'Месяц',
};

export const TimesheetScreen = () => {
  const { timeEntries, endCurrentTimeEntry } = useAppStore();
  const currentEmployee = useAppStore(getCurrentEmployee);
  const activeEntry = useAppStore(getCurrentActiveEntry);
  const [period, setPeriod] = useState<Exclude<TimesheetPeriod, 'day'>>('week');
  const [shortShiftPrompt, setShortShiftPrompt] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const currentEmployeeId = currentEmployee?.id ?? null;

  const myEntries = useMemo(
    () =>
      currentEmployeeId
        ? timeEntries.filter((entry) => entry.userId === currentEmployeeId)
        : [],
    [currentEmployeeId, timeEntries],
  );
  const filteredEntries = useMemo(
    () => getPeriodEntries(myEntries, period).sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [myEntries, period],
  );
  const weeklyEntries = useMemo(() => getPeriodEntries(myEntries, 'week'), [myEntries]);
  const monthlyEntries = useMemo(() => getPeriodEntries(myEntries, 'month'), [myEntries]);
  const weekHours = weeklyEntries.reduce(
    (sum, entry) => sum + durationHours(entry.startAt, entry.endAt),
    0,
  );
  const monthHours = monthlyEntries.reduce(
    (sum, entry) => sum + durationHours(entry.startAt, entry.endAt),
    0,
  );
  const todayEarned = calcEarnings(
    myEntries.filter((entry) => entry.endAt && isSameDay(new Date(entry.endAt), new Date())),
    getProfileRate(currentEmployee),
  );

  if (!currentEmployee) {
    return null;
  }

  const onCloseNow = (force = false) => {
    const result = endCurrentTimeEntry({ force });

    if (result.requiresConfirmation) {
      setShortShiftPrompt(true);
      return;
    }

    if (result.ok) {
      setShortShiftPrompt(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink/55">Табель</p>
          <h1 className="font-display text-2xl font-semibold">Мои часы и смены</h1>
        </div>
        <Link to="/profile" className="rounded-2xl bg-fog px-3 py-2 text-sm font-semibold">
          Назад
        </Link>
      </div>

      {activeEntry && !bannerDismissed ? (
        <Card className="border border-clay/20 bg-clay/10">
          <SectionTitle title="У вас открыта смена" action={<Pill tone="warning">Сейчас</Pill>} />
          <p className="text-sm text-ink/65">
            Старт {formatClock(activeEntry.startAt)} · длительность{' '}
            {formatDuration(durationHours(activeEntry.startAt, null))}
          </p>
          <div className="mt-4 flex gap-3">
            <PrimaryButton className="flex-1" onClick={() => onCloseNow()}>
              Закрыть сейчас
            </PrimaryButton>
            <SecondaryButton className="flex-1" onClick={() => setBannerDismissed(true)}>
              Продолжить
            </SecondaryButton>
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Итоги" />
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/45">Неделя</p>
            <p className="mt-2 text-lg font-semibold">{weekHours.toFixed(1)} ч</p>
          </div>
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/45">Месяц</p>
            <p className="mt-2 text-lg font-semibold">{monthHours.toFixed(1)} ч</p>
          </div>
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/45">Сегодня</p>
            <p className="mt-2 text-lg font-semibold">{todayEarned.toFixed(0)} ₽</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {(['week', 'month'] as Exclude<TimesheetPeriod, 'day'>[]).map((value) => (
          <button
            key={value}
            className={`rounded-2xl px-3 py-4 text-sm font-semibold ${
              period === value ? 'bg-ink text-white' : 'bg-white/90 text-ink shadow-card'
            }`}
            onClick={() => setPeriod(value)}
          >
            {periodLabels[value]}
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle title="Смены" action={<Pill>{filteredEntries.length}</Pill>} />
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-fog p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{formatDayLabel(entry.startAt)}</p>
                  <p className="text-sm text-ink/55">
                    {formatClock(entry.startAt)} -{' '}
                    {entry.endAt ? formatClock(entry.endAt) : 'идет'}
                  </p>
                </div>
                <Pill tone={entry.earlyStart ? 'warning' : 'default'}>
                  {formatDuration(durationHours(entry.startAt, entry.endAt))}
                </Pill>
              </div>
              {entry.earlyStart ? (
                <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm text-ink/70">
                  <p className="font-semibold">Ранний старт</p>
                  <p className="mt-1">{entry.earlyReason || 'Причина не указана'}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      {shortShiftPrompt ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <h3 className="text-lg font-semibold">Случайно?</h3>
            <p className="mt-2 text-sm text-ink/60">
              Смена короче 15 минут. Подтвердите только если хотите закрыть ее сейчас.
            </p>
            <div className="mt-4 flex gap-3">
              <PrimaryButton onClick={() => onCloseNow(true)}>Да, закрыть</PrimaryButton>
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
    </div>
  );
};
