import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appLinks } from '../config/links';
import {
  calcEarnings,
  getPresetRate,
  isSameDay,
} from '../lib/timeTracking';
import {
  getCurrentEmployee,
  getDepartmentLabel,
  getEntriesForPeriod,
  getEntriesHours,
  getProfileRate,
  getRoleLabel,
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
const sanitizePin = (value: string) => value.replace(/\D/g, '').slice(0, 6);

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
  const currentEmployee = useAppStore(getCurrentEmployee);
  const loadEmployees = useAppStore((store) => store.loadEmployees);
  const employeesLoading = useAppStore((store) => store.employeesLoading);
  const [period, setPeriod] = useState<TimesheetPeriod>('week');
  const [department, setDepartment] = useState<TeamDepartment | 'all'>('all');
  const [userId, setUserId] = useState<string | 'all'>('all');

  useEffect(() => {
    if (currentEmployee?.role === 'owner') {
      void loadEmployees();
    }
  }, [currentEmployee?.role, loadEmployees]);

  if (currentEmployee?.role !== 'owner') {
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
      <SectionTitle
        title="Owner Dashboard"
        action={
          <Link className="text-sm font-semibold text-clay" to="/profile/employees">
            Сотрудники
          </Link>
        }
      />
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
          {state.employees
            .filter((employee) => employee.isActive)
            .map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
        </Select>
      </div>
      {employeesLoading ? <p className="mt-4 text-sm text-ink/55">Синхронизируем команду…</p> : null}
      <div className="mt-4 space-y-3">
        {filtered.rows.map((row) => (
          <div key={row.employee.id} className="rounded-2xl bg-fog p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.employee.fullName}</p>
                <p className="text-sm text-ink/55">
                  {row.employee.positionTitle} · {getDepartmentLabel(row.employee.department)}
                </p>
              </div>
              <Pill>{row.hours.toFixed(1)} ч</Pill>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Смен</p>
                <p className="mt-1 text-sm font-semibold">{row.shifts}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Часы</p>
                <p className="mt-1 text-sm font-semibold">{row.hours.toFixed(1)}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Ранние</p>
                <p className="mt-1 text-sm font-semibold">{row.earlyStarts}</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-2">
                <p className="text-ink/45">Сумма</p>
                <p className="mt-1 text-sm font-semibold">{row.earnings.toFixed(0)} ₽</p>
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
    tasks,
    losses,
    resetDemo,
    timeEntries,
    setHourlyRate,
    changeMyPin,
    logout,
    loadEmployees,
  } = useAppStore();
  const currentEmployee = useAppStore(getCurrentEmployee);
  const [rateInput, setRateInput] = useState(currentEmployee?.hourlyRate?.toString() ?? '');
  const [earningsVisible, setEarningsVisible] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [showPinValues, setShowPinValues] = useState(false);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  useEffect(() => {
    setRateInput(currentEmployee?.hourlyRate?.toString() ?? '');
  }, [currentEmployee?.hourlyRate]);

  useEffect(() => {
    if (!earningsVisible) {
      return undefined;
    }

    const timer = window.setTimeout(() => setEarningsVisible(false), revealDurationMs);

    return () => window.clearTimeout(timer);
  }, [earningsVisible]);

  useEffect(() => {
    if (currentEmployee?.role === 'owner') {
      void loadEmployees();
    }
  }, [currentEmployee?.role, loadEmployees]);

  if (!currentEmployee) {
    return null;
  }

  const acceptedTasks = tasks.filter((task) => task.status === 'accepted').length;
  const waitingTasks = tasks.filter((task) => task.status === 'done').length;
  const overdueTasks = tasks.filter((task) => task.status === 'returned').length;
  const totalPoints = tasks
    .filter((task) => task.status === 'accepted')
    .reduce((sum, task) => sum + task.points, 0);
  const weeklyLoss = losses.spoilage + losses.staffMeal;
  const myEntries = timeEntries.filter((entry) => entry.userId === currentEmployee.id);
  const weekEntries = getEntriesForPeriod(myEntries, 'week');
  const monthEntries = getEntriesForPeriod(myEntries, 'month');
  const todayClosedEntries = myEntries.filter(
    (entry) => entry.endAt && isSameDay(new Date(entry.endAt), new Date()),
  );
  const weeklyHours = getEntriesHours(weekEntries);
  const resolvedRate = getProfileRate(currentEmployee);
  const monthlyShiftIncome = calcEarnings(monthEntries, resolvedRate);
  const monthlyTaskRewards = 0;
  const monthlyOwnerBonuses = 0;
  const monthlyIncomeEstimate =
    monthlyShiftIncome + monthlyTaskRewards + monthlyOwnerBonuses;
  const todayEarned = calcEarnings(todayClosedEntries, resolvedRate);
  const isFixedRate =
    currentEmployee.role === 'waiter' || currentEmployee.role === 'bartender';
  const presetRate = getPresetRate(currentEmployee.role);

  const saveRate = async () => {
    if (isFixedRate) {
      return;
    }

    setSettingsError(null);
    setSettingsSuccess(null);
    const parsed = Number(rateInput);
    const result = await setHourlyRate(rateInput.trim() ? parsed || 0 : null);

    if (!result.ok) {
      setSettingsError(result.reason ?? 'Не удалось сохранить ставку');
      return;
    }

    setSettingsSuccess('Ставка обновлена');
  };

  const submitPinChange = async () => {
    setPinError(null);
    setPinSuccess(null);

    if (newPin !== confirmNewPin) {
      setPinError('Новый PIN и подтверждение не совпадают');
      return;
    }

    if (currentPin === newPin) {
      setPinError('Новый PIN должен отличаться от текущего');
      return;
    }

    setPinSaving(true);
    const result = await changeMyPin(currentPin, newPin);
    setPinSaving(false);

    if (!result.ok) {
      setPinError(result.reason ?? 'Не удалось сменить PIN');
      return;
    }

    setCurrentPin('');
    setNewPin('');
    setConfirmNewPin('');
    setShowPinModal(false);
    setShowPinValues(false);
    setPinSuccess('PIN обновлен');
    setSettingsSuccess('PIN обновлен');
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xl font-semibold">{currentEmployee.fullName}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            title="Настройки профиля"
            aria-label="Настройки профиля"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fog text-lg"
            onClick={() => {
              setSettingsError(null);
              setSettingsSuccess(null);
              setShowSettingsModal(true);
            }}
          >
            ⚙️
          </button>
          <button
            type="button"
            title="Выйти"
            aria-label="Выйти"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-fog text-lg"
            onClick={logout}
          >
            🚪
          </button>
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
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-fog p-4">
            <p className="text-xs text-ink/50">Сегодня</p>
            <div className="mt-2">
              <StatValue value={`${todayEarned.toFixed(0)} ₽`} visible={earningsVisible} />
            </div>
          </div>
          <div className="rounded-2xl bg-fog p-4">
            <p className="text-xs text-ink/50">За месяц</p>
            <div className="mt-2">
              <StatValue value={`${monthlyIncomeEstimate.toFixed(0)} ₽`} visible={earningsVisible} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Мой прогресс</p>
          <p className="mt-2 text-2xl font-semibold">{totalPoints}</p>
        </Card>
        <Card className="bg-white/80">
          <p className="text-xs text-ink/50">Принятые задачи</p>
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

      {showSettingsModal ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <SectionTitle title="Настройки профиля" action={<Pill>{getRoleLabel(currentEmployee.role)}</Pill>} />
            <div className="space-y-4">
              <div className="rounded-2xl bg-fog p-4">
                <p className="text-xs text-ink/45">Ставка</p>
                {isFixedRate ? (
                  <>
                    <p className="mt-2 text-lg font-semibold">{presetRate} ₽ / час</p>
                    <p className="mt-1 text-sm text-ink/55">Фиксированная ставка по роли</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-ink/60">
                      Ставка влияет только на предварительный расчёт дохода.
                    </p>
                    <div className="mt-3 flex gap-3">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Введите ставку"
                        value={rateInput}
                        onChange={(event) => setRateInput(event.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
                        onClick={() => void saveRate()}
                      >
                        Сохранить
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl bg-fog p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink/45">Служебный PIN</p>
                    <p className="mt-1 text-sm text-ink/60">
                      Меняйте личный PIN здесь, если хотите обновить доступ без owner.
                    </p>
                  </div>
                  <Pill>4–6 цифр</Pill>
                </div>
                <div className="mt-3">
                  <PrimaryButton
                    onClick={() => {
                      setPinError(null);
                      setPinSuccess(null);
                      setShowPinModal(true);
                    }}
                  >
                    Сменить PIN
                  </PrimaryButton>
                </div>
              </div>
              {settingsError ? <p className="text-sm text-red-700">{settingsError}</p> : null}
              {settingsSuccess || pinSuccess ? (
                <p className="text-sm text-pine">{settingsSuccess ?? pinSuccess}</p>
              ) : null}
            </div>
            <div className="mt-4">
              <SecondaryButton
                onClick={() => {
                  setShowSettingsModal(false);
                  setSettingsError(null);
                }}
              >
                Закрыть
              </SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {showPinModal ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/30">
          <div className="w-full rounded-t-[2rem] bg-white p-5">
            <SectionTitle title="Сменить PIN" action={<Pill>Личный доступ</Pill>} />
            <div className="space-y-3">
              <Input
                type={showPinValues ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="Текущий PIN"
                value={currentPin}
                onChange={(event) => setCurrentPin(sanitizePin(event.target.value))}
              />
              <Input
                type={showPinValues ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="Новый PIN"
                value={newPin}
                onChange={(event) => setNewPin(sanitizePin(event.target.value))}
              />
              <Input
                type={showPinValues ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="Повторите новый PIN"
                value={confirmNewPin}
                onChange={(event) => setConfirmNewPin(sanitizePin(event.target.value))}
              />
              <button
                className="text-sm font-semibold text-clay"
                onClick={() => setShowPinValues((value) => !value)}
              >
                {showPinValues ? '🙈 Скрыть' : '👁 Показать'}
              </button>
              {pinError ? <p className="text-sm text-red-700">{pinError}</p> : null}
            </div>
            <div className="mt-4 flex gap-3">
              <PrimaryButton disabled={pinSaving} onClick={() => void submitPinChange()}>
                Сохранить новый PIN
              </PrimaryButton>
              <button
                className="rounded-2xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                onClick={() => {
                  setShowPinModal(false);
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                  setPinError(null);
                  setShowPinValues(false);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};
