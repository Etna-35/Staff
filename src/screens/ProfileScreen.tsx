import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appLinks } from '../config/links';
import {
  calcEarnings,
  durationHours,
  formatDuration,
  getPresetRate,
  isBeforeShiftStart,
  isSameDay,
} from '../lib/timeTracking';
import {
  getCurrentActiveEntry,
  getCurrentProfile,
  getDepartmentLabel,
  getEntriesForPeriod,
  getEntriesHours,
  getProfileRate,
  getRolePresetLabel,
  getTeamStats,
  useAppStore,
} from '../store/useAppStore';
import type { TeamDepartment, TimesheetPeriod } from '../types/domain';
import {
  Card,
  Input,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Select,
} from '../components/ui';

const revealDurationMs = 12_000;

const periodLabels: Record<TimesheetPeriod, string> = {
  day: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
};

const StatValue = ({
  value,
  visible,
}: {
  value: string;
  visible: boolean;
}) => (
  <div className="space-y-1">
    <p
      className={`text-2xl font-semibold transition ${
        visible ? 'blur-0' : 'select-none blur-md'
      }`}
    >
      {visible ? value : '••••• ₽'}
    </p>
    <p className="text-xs text-ink/45">≈ Предварительный расчёт</p>
  </div>
);

const OwnerStats = () => {
  const state = useAppStore();
  const { staffProfiles, role } = state;
  const [period, setPeriod] = useState<TimesheetPeriod>('week');
  const [department, setDepartment] = useState<TeamDepartment | 'all'>('all');
  const [userId, setUserId] = useState<string | 'all'>('all');

  if (role !== 'owner') {
    return null;
  }

  const today = getTeamStats(state, {
    period: 'day',
    department: 'all',
    userId: 'all',
  });
  const week = getTeamStats(state, {
    period: 'week',
    department: 'all',
    userId: 'all',
  });
  const month = getTeamStats(state, {
    period: 'month',
    department: 'all',
    userId: 'all',
  });
  const filtered = getTeamStats(state, {
    period,
    department,
    userId,
  });

  return (
    <Card>
      <SectionTitle title="Статистика команды" action={<Pill tone="warning">Owner</Pill>} />
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-fog p-3">
          <p className="text-xs text-ink/45">Сегодня</p>
          <p className="mt-2 text-lg font-semibold">{today.totalHours.toFixed(1)} ч</p>
        </div>
        <div className="rounded-2xl bg-fog p-3">
          <p className="text-xs text-ink/45">Неделя</p>
          <p className="mt-2 text-lg font-semibold">{week.totalHours.toFixed(1)} ч</p>
        </div>
        <div className="rounded-2xl bg-fog p-3">
          <p className="text-xs text-ink/45">Месяц</p>
          <p className="mt-2 text-lg font-semibold">{month.totalHours.toFixed(1)} ч</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(['day', 'week', 'month'] as TimesheetPeriod[]).map((value) => (
          <button
            key={value}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
              period === value ? 'bg-ink text-white' : 'bg-fog text-ink'
            }`}
            onClick={() => setPeriod(value)}
          >
            {periodLabels[value]}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Select
          value={department}
          onChange={(event) => setDepartment(event.target.value as TeamDepartment | 'all')}
        >
          <option value="all">Все отделы</option>
          <option value="kitchen">Кухня</option>
          <option value="bar">Бар</option>
          <option value="hall">Зал</option>
          <option value="other">Другое</option>
        </Select>
        <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="all">Все сотрудники</option>
          {staffProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4 space-y-3">
        {filtered.rows.map((row) => (
          <div key={row.profile.id} className="rounded-2xl bg-fog p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.profile.name}</p>
                <p className="text-sm text-ink/55">
                  {getRolePresetLabel(row.profile.rolePreset)} ·{' '}
                  {getDepartmentLabel(row.profile.department)}
                </p>
              </div>
              <Pill>{row.hours.toFixed(1)} ч</Pill>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Смен</p>
                <p className="mt-1 font-semibold text-sm">{row.shifts}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Часы</p>
                <p className="mt-1 font-semibold text-sm">{row.hours.toFixed(1)}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Ранние</p>
                <p className="mt-1 font-semibold text-sm">{row.earlyStarts}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Сумма</p>
                <p className="mt-1 font-semibold text-sm">{row.earnings.toFixed(0)} ₽</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const ProfileScreen = () => {
  const {
    role,
    setRole,
    tasks,
    losses,
    resetDemo,
    telegramName,
    timeEntries,
    currentUserId,
    setHourlyRate,
    startTimeEntry,
    endCurrentTimeEntry,
  } = useAppStore();
  const currentProfile = useAppStore(getCurrentProfile);
  const activeEntry = useAppStore(getCurrentActiveEntry);
  const [rateInput, setRateInput] = useState(currentProfile?.hourlyRate?.toString() ?? '');
  const [showEarlyStartModal, setShowEarlyStartModal] = useState(false);
  const [earlyReason, setEarlyReason] = useState('');
  const [shortShiftPrompt, setShortShiftPrompt] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [earningsVisible, setEarningsVisible] = useState(false);

  useEffect(() => {
    setRateInput(currentProfile?.hourlyRate?.toString() ?? '');
  }, [currentProfile?.hourlyRate]);

  useEffect(() => {
    if (!earningsVisible) {
      return undefined;
    }

    const timer = window.setTimeout(() => setEarningsVisible(false), revealDurationMs);

    return () => window.clearTimeout(timer);
  }, [earningsVisible]);

  const acceptedTasks = tasks.filter((task) => task.status === 'accepted').length;
  const waitingTasks = tasks.filter((task) => task.status === 'done').length;
  const overdueTasks = tasks.filter((task) => task.status === 'returned').length;
  const totalPoints = tasks
    .filter((task) => task.status === 'accepted')
    .reduce((sum, task) => sum + task.points, 0);
  const weeklyLoss = losses.spoilage + losses.staffMeal;
  const myEntries = timeEntries.filter((entry) => entry.userId === currentUserId);
  const weekEntries = getEntriesForPeriod(myEntries, 'week');
  const monthEntries = getEntriesForPeriod(myEntries, 'month');
  const todayClosedEntries = myEntries.filter(
    (entry) => entry.endAt && isSameDay(new Date(entry.endAt), new Date()),
  );
  const weeklyHours = getEntriesHours(weekEntries);
  const monthlyHours = getEntriesHours(monthEntries);
  const resolvedRate = getProfileRate(currentProfile);
  const estimatedIncome = calcEarnings(monthEntries, resolvedRate);
  const todayEarned = calcEarnings(todayClosedEntries, resolvedRate);
  const isFixedRate =
    currentProfile?.rolePreset === 'waiter' || currentProfile?.rolePreset === 'bartender';
  const presetRate = currentProfile ? getPresetRate(currentProfile.rolePreset) : null;
  const displayName = telegramName || currentProfile?.name || 'Сотрудник';
  const workedNowLabel = activeEntry
    ? formatDuration(durationHours(activeEntry.startAt, null))
    : null;

  const saveRate = () => {
    if (isFixedRate) {
      return;
    }

    const parsed = Number(rateInput);
    setHourlyRate(rateInput.trim() ? parsed || 0 : null);
  };

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
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink/55">Профиль</p>
        <h1 className="font-display text-2xl font-semibold">Мой пульт смены</h1>
      </div>

      <Card>
        <SectionTitle title="Профиль" action={<Pill>{role === 'owner' ? 'Owner/Admin' : 'Employee'}</Pill>} />
        <div className="space-y-4">
          <div className="rounded-2xl bg-fog p-4">
            <p className="text-xs text-ink/45">Имя</p>
            <p className="mt-2 text-xl font-semibold">{displayName}</p>
            <p className="mt-1 text-sm text-ink/55">
              {currentProfile ? getRolePresetLabel(currentProfile.rolePreset) : 'Сотрудник'}
              {currentProfile?.tenureLabel ? ` · стаж ${currentProfile.tenureLabel}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                role === 'employee' ? 'bg-ink text-white' : 'bg-fog text-ink'
              }`}
              onClick={() => setRole('employee')}
            >
              Employee
            </button>
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                role === 'owner' ? 'bg-ink text-white' : 'bg-fog text-ink'
              }`}
              onClick={() => setRole('owner')}
            >
              Owner/Admin
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Моя ставка</p>
            {isFixedRate ? (
              <div className="rounded-2xl bg-fog p-4">
                <p className="text-lg font-semibold">{presetRate} ₽ / час</p>
                <p className="mt-1 text-sm text-ink/55">Фиксированная ставка по роли</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Input
                  type="number"
                  min="0"
                  placeholder="Введите ставку"
                  value={rateInput}
                  onChange={(event) => setRateInput(event.target.value)}
                />
                <button
                  className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
                  onClick={saveRate}
                >
                  Сохранить
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Табель" action={<Link to="/profile/timesheet" className="text-sm font-semibold text-clay">Открыть</Link>} />
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
              Идет {workedNowLabel} · старт {new Date(activeEntry.startAt).toLocaleTimeString('ru-RU', {
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
            <p className="text-xs text-ink/45">Нормальная смена</p>
            <p className="mt-2 text-lg font-semibold">11:20 - 23:20</p>
          </div>
          {activeEntry ? (
            <PrimaryButton onClick={() => onEndShift()}>Закончить смену</PrimaryButton>
          ) : (
            <PrimaryButton onClick={onStartShift}>Начать смену</PrimaryButton>
          )}
          {entryError ? <p className="text-sm text-red-700">{entryError}</p> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Оценка дохода"
          action={
            <button
              className="text-sm font-semibold text-clay"
              onClick={() => setEarningsVisible((current) => !current)}
            >
              👁 Показать
            </button>
          }
        />
        <StatValue value={`${estimatedIncome.toFixed(0)} ₽`} visible={earningsVisible} />
      </Card>

      {todayClosedEntries.length > 0 ? (
        <Card>
          <SectionTitle title="Сегодня заработано" />
          <StatValue value={`${todayEarned.toFixed(0)} ₽`} visible={earningsVisible} />
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Мой прогресс</p>
          <p className="mt-2 text-2xl font-semibold">{totalPoints} pts</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Принятые миссии</p>
          <p className="mt-2 text-2xl font-semibold">{acceptedTasks}</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Ожидают приемки</p>
          <p className="mt-2 text-2xl font-semibold">{waitingTasks}</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Просрочки</p>
          <p className="mt-2 text-2xl font-semibold">{overdueTasks}</p>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Неделя" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/50">Потери</p>
            <p className="mt-1 text-xl font-semibold">{weeklyLoss} ₽</p>
            <p className="text-xs text-ink/50">Если без выручки, показываем сумму</p>
          </div>
          <div className="rounded-2xl bg-fog p-3">
            <p className="text-xs text-ink/50">Часы</p>
            <p className="mt-1 text-xl font-semibold">{weeklyHours.toFixed(1)} ч</p>
            <p className="text-xs text-ink/50">Локальный табель за неделю</p>
          </div>
        </div>
      </Card>

      <OwnerStats />

      <Card>
        <SectionTitle title="Полезное" />
        <div className="space-y-2">
          <a
            href={appLinks.knowledgeBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl bg-fog px-4 py-3 text-sm font-semibold"
          >
            База знаний
          </a>
          <SecondaryButton onClick={resetDemo}>Сбросить демо-данные</SecondaryButton>
        </div>
      </Card>

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
              <PrimaryButton
                disabled={!earlyReason.trim()}
                onClick={confirmEarlyStart}
              >
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
    </div>
  );
};
