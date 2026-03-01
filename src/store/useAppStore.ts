import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mockState } from '../data/mock';
import {
  MIN_SHIFT_MINUTES,
  SHIFT_END_HOUR,
  SHIFT_END_MINUTE,
  SHIFT_START_HOUR,
  SHIFT_START_MINUTE,
  calcEarnings,
  durationHours,
  formatDuration,
  getPeriodEntries,
  getPresetRate,
  isBeforeShiftStart,
  resolveHourlyRate,
} from '../lib/timeTracking';
import type {
  AppState,
  HandoffArea,
  RequestCategory,
  Role,
  StaffProfile,
  StageKey,
  Task,
  TeamDepartment,
  TimeEntry,
  TimesheetPeriod,
} from '../types/domain';

type RequestInput = {
  category: RequestCategory;
  item: string;
  remaining: string;
  needed: string;
  comment: string;
};

type Store = AppState & {
  setTelegramName: (name: string) => void;
  setRole: (role: Role) => void;
  setHourlyRate: (rate: number | null) => void;
  createTask: (title: string, assignee: string, points: number) => void;
  markTaskDone: (taskId: string) => void;
  acceptTask: (taskId: string) => void;
  returnTask: (taskId: string, reason: string) => void;
  saveLosses: (spoilage: number, staffMeal: number, rd: number) => void;
  updateHandoffReason: (itemId: string, reason: string) => void;
  toggleHandoffItem: (itemId: string) => void;
  submitRequest: (input: RequestInput) => void;
  completeStage: (stage: StageKey) => void;
  closeShift: () => void;
  startTimeEntry: (payload?: { now?: string; earlyReason?: string | null }) => {
    ok: boolean;
    reason?: string;
  };
  endCurrentTimeEntry: (payload?: { now?: string; force?: boolean }) => {
    ok: boolean;
    reason?: string;
    requiresConfirmation?: boolean;
  };
  getCurrentProfile: () => StaffProfile | undefined;
  getCurrentUserEntries: () => TimeEntry[];
  getCurrentActiveEntry: () => TimeEntry | undefined;
  resetDemo: () => void;
};

const storageKey = 'restaurant-os-mvp';

const cloneInitialState = (): AppState => JSON.parse(JSON.stringify(mockState)) as AppState;

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    const statusOrder = {
      done: 0,
      assigned: 1,
      returned: 2,
      accepted: 3,
    } as const;

    return statusOrder[a.status] - statusOrder[b.status];
  });

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...cloneInitialState(),
      setTelegramName: (name) => set({ telegramName: name }),
      setRole: (role) => set({ role }),
      setHourlyRate: (rate) =>
        set((state) => ({
          staffProfiles: state.staffProfiles.map((profile) =>
            profile.id === state.currentUserId
              ? {
                  ...profile,
                  hourlyRate: rate,
                }
              : profile,
          ),
        })),
      createTask: (title, assignee, points) =>
        set((state) => ({
          tasks: sortTasks([
            {
              id: crypto.randomUUID(),
              title,
              assignee,
              points,
              status: 'assigned',
              dueLabel: 'новая миссия',
            },
            ...state.tasks,
          ]),
        })),
      markTaskDone: (taskId) =>
        set((state) => ({
          tasks: sortTasks(
            state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: 'done',
                    completedAt: new Date().toISOString(),
                    returnReason: undefined,
                  }
                : task,
            ),
          ),
        })),
      acceptTask: (taskId) =>
        set((state) => ({
          tasks: sortTasks(
            state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: 'accepted',
                    acceptedAt: new Date().toISOString(),
                    returnReason: undefined,
                  }
                : task,
            ),
          ),
        })),
      returnTask: (taskId, reason) =>
        set((state) => ({
          tasks: sortTasks(
            state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: 'returned',
                    returnReason: reason || 'Нужно доработать',
                  }
                : task,
            ),
          ),
        })),
      saveLosses: (spoilage, staffMeal, rd) =>
        set({
          losses: {
            spoilage,
            staffMeal,
            rd,
            updatedAt: new Date().toISOString(),
          },
        }),
      updateHandoffReason: (itemId, reason) =>
        set((state) => ({
          handoffItems: state.handoffItems.map((item) =>
            item.id === itemId ? { ...item, reason } : item,
          ),
        })),
      toggleHandoffItem: (itemId) =>
        set((state) => ({
          handoffItems: state.handoffItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item,
          ),
        })),
      submitRequest: (input) =>
        set((state) => ({
          requests: [
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              ...input,
            },
            ...state.requests,
          ],
        })),
      completeStage: (stage) =>
        set((state) => ({
          shift: {
            ...state.shift,
            leftoversChecked:
              stage === 'leftovers' ? true : state.shift.leftoversChecked,
            closingPhotosChecked:
              stage === 'closingPhotos' ? true : state.shift.closingPhotosChecked,
          },
        })),
      closeShift: () =>
        set((state) => ({
          shift: {
            ...state.shift,
            closedAt: new Date().toISOString(),
          },
        })),
      startTimeEntry: (payload) => {
        const state = get();
        const activeEntry = state.timeEntries.find(
          (entry) => entry.userId === state.currentUserId && !entry.endAt,
        );

        if (activeEntry) {
          return {
            ok: false,
            reason: 'У вас уже есть активная смена',
          };
        }

        const currentProfile = state.staffProfiles.find(
          (profile) => profile.id === state.currentUserId,
        );

        if (!currentProfile) {
          return {
            ok: false,
            reason: 'Профиль сотрудника не найден',
          };
        }

        const startAt = payload?.now ?? new Date().toISOString();
        const startDate = new Date(startAt);
        const earlyStart = isBeforeShiftStart(startDate);
        const earlyReason = payload?.earlyReason?.trim() || null;

        if (earlyStart && !earlyReason) {
          return {
            ok: false,
            reason: 'Для раннего старта нужна причина',
          };
        }

        set((current) => ({
          timeEntries: [
            {
              id: crypto.randomUUID(),
              userId: current.currentUserId,
              rolePreset: currentProfile.rolePreset,
              startAt,
              endAt: null,
              earlyStart,
              earlyReason,
              createdAt: new Date().toISOString(),
            },
            ...current.timeEntries,
          ],
        }));

        return { ok: true };
      },
      endCurrentTimeEntry: (payload) => {
        const state = get();
        const activeEntry = state.timeEntries.find(
          (entry) => entry.userId === state.currentUserId && !entry.endAt,
        );

        if (!activeEntry) {
          return {
            ok: false,
            reason: 'Нет открытой смены',
          };
        }

        const endAt = payload?.now ?? new Date().toISOString();
        const workedMinutes = durationHours(activeEntry.startAt, endAt) * 60;

        if (workedMinutes < MIN_SHIFT_MINUTES && !payload?.force) {
          return {
            ok: false,
            requiresConfirmation: true,
            reason: 'Смена длится меньше 15 минут. Случайно?',
          };
        }

        set((current) => ({
          timeEntries: current.timeEntries.map((entry) =>
            entry.id === activeEntry.id
              ? {
                  ...entry,
                  endAt,
                }
              : entry,
          ),
        }));

        return { ok: true };
      },
      getCurrentProfile: () =>
        get().staffProfiles.find((profile) => profile.id === get().currentUserId),
      getCurrentUserEntries: () =>
        get().timeEntries.filter((entry) => entry.userId === get().currentUserId),
      getCurrentActiveEntry: () =>
        get().timeEntries.find((entry) => entry.userId === get().currentUserId && !entry.endAt),
      resetDemo: () => set(cloneInitialState()),
    }),
    {
      name: storageKey,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const getCriticalityLabel = (value: string) => {
  const labels = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  } as const;

  return labels[value as keyof typeof labels];
};

export const getAreaLabel = (area: HandoffArea) =>
  area === 'kitchen' ? 'Кухня' : 'Бар';

export const getDepartmentLabel = (department: TeamDepartment) => {
  const labels: Record<TeamDepartment, string> = {
    kitchen: 'Кухня',
    bar: 'Бар',
    hall: 'Зал',
    other: 'Другое',
  };

  return labels[department];
};

export const getRolePresetLabel = (rolePreset: StaffProfile['rolePreset']) => {
  const labels: Record<StaffProfile['rolePreset'], string> = {
    waiter: 'Официант',
    bartender: 'Бармен',
    cook: 'Повар',
    custom: 'Своя ставка',
  };

  return labels[rolePreset];
};

export const getCurrentProfile = (state: Store) =>
  state.staffProfiles.find((profile) => profile.id === state.currentUserId);

export const getCurrentActiveEntry = (state: Store) =>
  state.timeEntries.find((entry) => entry.userId === state.currentUserId && !entry.endAt);

export const getUserEntries = (state: Store, userId: string) =>
  state.timeEntries.filter((entry) => entry.userId === userId);

export const getProfileRate = (profile: StaffProfile | undefined) =>
  profile ? resolveHourlyRate(profile) : null;

export const getEntriesHours = (entries: TimeEntry[], now = new Date()) =>
  entries.reduce((sum, entry) => sum + durationHours(entry.startAt, entry.endAt, now), 0);

export const getEntriesForPeriod = (
  entries: TimeEntry[],
  period: TimesheetPeriod,
  now = new Date(),
) => getPeriodEntries(entries, period, now);

export const getEntryEarnings = (
  entries: TimeEntry[],
  profile: StaffProfile | undefined,
  now = new Date(),
) => calcEarnings(entries, getProfileRate(profile), now);

export const getNormalShiftLabel = () =>
  `${String(SHIFT_START_HOUR).padStart(2, '0')}:${String(SHIFT_START_MINUTE).padStart(
    2,
    '0',
  )} - ${String(SHIFT_END_HOUR).padStart(2, '0')}:${String(SHIFT_END_MINUTE).padStart(
    2,
    '0',
  )}`;

export const getTeamStats = (
  state: Store,
  filters: {
    period: TimesheetPeriod;
    department: TeamDepartment | 'all';
    userId: string | 'all';
  },
  now = new Date(),
) => {
  const periodEntries = getPeriodEntries(state.timeEntries, filters.period, now);
  const filteredProfiles = state.staffProfiles.filter((profile) => {
    if (filters.department !== 'all' && profile.department !== filters.department) {
      return false;
    }

    if (filters.userId !== 'all' && profile.id !== filters.userId) {
      return false;
    }

    return true;
  });

  const rows = filteredProfiles
    .map((profile) => {
      const entries = periodEntries.filter((entry) => entry.userId === profile.id);
      const hours = getEntriesHours(entries, now);
      const earnings = calcEarnings(entries, resolveHourlyRate(profile), now);

      return {
        profile,
        shifts: entries.length,
        hours,
        earlyStarts: entries.filter((entry) => entry.earlyStart).length,
        earnings,
      };
    })
    .sort((left, right) => right.hours - left.hours);

  return {
    rows,
    totalHours: rows.reduce((sum, row) => sum + row.hours, 0),
    totalShifts: rows.reduce((sum, row) => sum + row.shifts, 0),
    totalEarlyStarts: rows.reduce((sum, row) => sum + row.earlyStarts, 0),
    totalEarnings: rows.reduce((sum, row) => sum + row.earnings, 0),
  };
};

export const getPresetRateHint = (profile: StaffProfile | undefined) =>
  profile ? getPresetRate(profile.rolePreset) : null;

export const formatHoursValue = (hours: number) =>
  formatDuration(Number(hours.toFixed(2)));
