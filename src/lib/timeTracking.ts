import type { Employee, EmployeeRole, TimeEntry, TimesheetPeriod } from '../types/domain';

export const SHIFT_START_HOUR = 11;
export const SHIFT_START_MINUTE = 20;
export const SHIFT_END_HOUR = 23;
export const SHIFT_END_MINUTE = 20;
export const MIN_SHIFT_MINUTES = 15;

export const resolveHourlyRate = (employee: Employee) => employee.hourlyRate;

export const getDefaultPositionTitle = (role: EmployeeRole) => {
  const labels: Record<EmployeeRole, string> = {
    waiter: 'Официант',
    bartender: 'Бармен',
    chef: 'Повар',
    owner: 'Админ',
  };

  return labels[role];
};

export const isBeforeShiftStart = (now: Date, shiftStart = '11:20') => {
  const [hourString, minuteString] = shiftStart.split(':');
  const shiftDate = new Date(now);

  shiftDate.setHours(Number(hourString), Number(minuteString), 0, 0);

  return now.getTime() < shiftDate.getTime();
};

export const durationHours = (
  startAt: string,
  endAt: string | null,
  now = new Date(),
) => {
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : now.getTime();

  return Math.max(0, end - start) / (1000 * 60 * 60);
};

export const calcEarnings = (
  entries: TimeEntry[],
  rate: number | null,
  now = new Date(),
) => {
  if (!rate) {
    return 0;
  }

  const hours = entries.reduce(
    (sum, entry) => sum + durationHours(entry.startAt, entry.endAt, now),
    0,
  );

  return hours * rate;
};

export const formatDuration = (hours: number) => {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const wholeHours = Math.floor(safeHours);
  const minutes = Math.round((safeHours - wholeHours) * 60);

  if (wholeHours <= 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${wholeHours} ч`;
  }

  return `${wholeHours} ч ${minutes} мин`;
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfWeek = (date: Date) => {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

const startOfMonth = (date: Date) => {
  const copy = startOfDay(date);
  copy.setDate(1);
  return copy;
};

export const getPeriodEntries = (
  entries: TimeEntry[],
  period: TimesheetPeriod,
  now = new Date(),
) => {
  const periodStart =
    period === 'day'
      ? startOfDay(now)
      : period === 'week'
        ? startOfWeek(now)
        : startOfMonth(now);

  return entries.filter((entry) => new Date(entry.startAt) >= periodStart);
};

export const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  });
