import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { mockState } from '../data/mock';
import {
  createPinCredentials,
  generatePinSalt,
  hashPin,
  isValidPinFormat,
} from '../lib/pinAuth';
import {
  MIN_SHIFT_MINUTES,
  SHIFT_END_HOUR,
  SHIFT_END_MINUTE,
  SHIFT_START_HOUR,
  SHIFT_START_MINUTE,
  calcEarnings,
  durationHours,
  formatDuration,
  getDefaultPositionTitle,
  getPeriodEntries,
  getPresetRate,
  isBeforeShiftStart,
  resolveHourlyRate,
} from '../lib/timeTracking';
import type {
  AppState,
  Employee,
  EmployeeRole,
  HandoffArea,
  RequestCategory,
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

type EmployeeDraft = {
  fullName: string;
  role: Exclude<EmployeeRole, 'owner'>;
  positionTitle?: string;
  pin: string;
  hourlyRate?: number | null;
};

type EmployeeUpdate = {
  fullName?: string;
  role?: EmployeeRole;
  positionTitle?: string;
  isActive?: boolean;
  hourlyRate?: number | null;
};

type ActionResult = {
  ok: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
};

type Store = AppState & {
  setTelegramName: (name: string) => void;
  ensureBootstrapOwner: () => void;
  ensureSessionValidity: () => void;
  unlockIfExpired: () => void;
  setupOwnerPin: (pin: string) => Promise<ActionResult>;
  loginWithPin: (
    employeeId: string,
    pin: string,
    rememberMe?: boolean,
  ) => Promise<ActionResult>;
  logout: () => void;
  setHourlyRate: (rate: number | null) => void;
  createEmployee: (input: EmployeeDraft) => Promise<ActionResult>;
  updateEmployee: (employeeId: string, updates: EmployeeUpdate) => ActionResult;
  resetEmployeePin: (employeeId: string, pin: string) => Promise<ActionResult>;
  deactivateEmployee: (employeeId: string) => ActionResult;
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
  startTimeEntry: (payload?: { now?: string; earlyReason?: string | null }) => ActionResult;
  endCurrentTimeEntry: (payload?: { now?: string; force?: boolean }) => ActionResult;
  resetDemo: () => void;
};

const storageKey = 'restaurant-os-mvp';
const lockDurationMs = 5 * 60 * 1000;

const cloneInitialState = (): AppState =>
  JSON.parse(JSON.stringify(mockState)) as AppState;

const getDefaultDepartment = (role: EmployeeRole): TeamDepartment => {
  if (role === 'waiter') {
    return 'hall';
  }

  if (role === 'bartender') {
    return 'bar';
  }

  if (role === 'chef') {
    return 'kitchen';
  }

  return 'other';
};

const makeOwnerSeed = (): Employee => ({
  id: 'emp-owner-yura',
  fullName: 'Юра',
  role: 'owner',
  positionTitle: 'Owner / Admin',
  pinHash: '',
  pinSalt: generatePinSalt(),
  isActive: true,
  createdAt: new Date().toISOString(),
  department: 'other',
  hourlyRate: null,
  tenureLabel: 'основатель',
});

const normalizeEmployees = (employees: Employee[]) => {
  if (employees.length === 0) {
    return [makeOwnerSeed()];
  }

  const normalized = employees.map((employee) => ({
    ...employee,
    pinSalt: employee.pinSalt || generatePinSalt(),
  }));

  if (!normalized.some((employee) => employee.role === 'owner')) {
    normalized.unshift(makeOwnerSeed());
  }

  return normalized;
};

const normalizeState = (state: AppState): AppState => {
  const employees = normalizeEmployees(state.employees ?? []);
  const activeEmployee = employees.find(
    (employee) =>
      employee.id === state.session?.employeeId &&
      employee.isActive &&
      Boolean(employee.pinHash),
  );

  return {
    ...state,
    telegramName: state.telegramName || 'Гость смены',
    employees,
    session: {
      isAuthenticated: Boolean(activeEmployee && state.session?.isAuthenticated),
      employeeId: activeEmployee?.id ?? null,
      lastAuthAt: activeEmployee ? state.session?.lastAuthAt ?? null : null,
      rememberMe: state.session?.rememberMe ?? true,
      failedAttempts: state.session?.failedAttempts ?? 0,
      lockUntil: state.session?.lockUntil ?? null,
    },
  };
};

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
      ...normalizeState(cloneInitialState()),
      setTelegramName: (name) => set({ telegramName: name }),
      ensureBootstrapOwner: () =>
        set((state) => {
          if (state.employees.length > 0) {
            return state;
          }

          return {
            ...state,
            employees: [makeOwnerSeed()],
          };
        }),
      ensureSessionValidity: () =>
        set((state) => {
          const currentEmployee = state.employees.find(
            (employee) => employee.id === state.session.employeeId,
          );

          if (
            !state.session.isAuthenticated ||
            !currentEmployee ||
            !currentEmployee.isActive ||
            !currentEmployee.pinHash
          ) {
            return {
              session: {
                ...state.session,
                isAuthenticated: false,
                employeeId: null,
                lastAuthAt: null,
              },
            };
          }

          return state;
        }),
      unlockIfExpired: () =>
        set((state) => {
          if (!state.session.lockUntil) {
            return state;
          }

          if (new Date(state.session.lockUntil).getTime() > Date.now()) {
            return state;
          }

          return {
            session: {
              ...state.session,
              failedAttempts: 0,
              lockUntil: null,
            },
          };
        }),
      setupOwnerPin: async (pin) => {
        const state = get();
        const owner = state.employees.find((employee) => employee.role === 'owner');

        if (!owner) {
          return {
            ok: false,
            reason: 'Owner аккаунт не найден',
          };
        }

        if (!isValidPinFormat(pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        const { hash, salt } = await createPinCredentials(pin);

        set((current) => ({
          employees: current.employees.map((employee) =>
            employee.id === owner.id
              ? {
                  ...employee,
                  pinHash: hash,
                  pinSalt: salt,
                }
              : employee,
          ),
          session: {
            isAuthenticated: true,
            employeeId: owner.id,
            lastAuthAt: new Date().toISOString(),
            rememberMe: true,
            failedAttempts: 0,
            lockUntil: null,
          },
        }));

        return { ok: true };
      },
      loginWithPin: async (employeeId, pin, rememberMe = true) => {
        get().unlockIfExpired();
        const state = get();

        if (state.session.lockUntil && new Date(state.session.lockUntil).getTime() > Date.now()) {
          return {
            ok: false,
            reason: 'Попробуйте позже',
          };
        }

        const employee = state.employees.find(
          (item) => item.id === employeeId && item.isActive,
        );

        if (!employee) {
          return {
            ok: false,
            reason: 'Сотрудник не найден',
          };
        }

        if (!employee.pinHash) {
          return {
            ok: false,
            reason: 'PIN еще не назначен',
          };
        }

        const hashed = await hashPin(pin, employee.pinSalt);

        if (hashed !== employee.pinHash) {
          const failedAttempts = state.session.failedAttempts + 1;
          const shouldLock = failedAttempts >= 5;

          set({
            session: {
              ...state.session,
              isAuthenticated: false,
              employeeId: null,
              lastAuthAt: null,
              failedAttempts: shouldLock ? 5 : failedAttempts,
              lockUntil: shouldLock
                ? new Date(Date.now() + lockDurationMs).toISOString()
                : null,
            },
          });

          return {
            ok: false,
            reason: shouldLock ? 'Попробуйте позже' : 'Неверный PIN',
          };
        }

        set({
          session: {
            isAuthenticated: true,
            employeeId: employee.id,
            lastAuthAt: new Date().toISOString(),
            rememberMe,
            failedAttempts: 0,
            lockUntil: null,
          },
        });

        return { ok: true };
      },
      logout: () =>
        set((state) => ({
          session: {
            ...state.session,
            isAuthenticated: false,
            employeeId: null,
            lastAuthAt: null,
          },
        })),
      setHourlyRate: (rate) =>
        set((state) => ({
          employees: state.employees.map((employee) =>
            employee.id === state.session.employeeId
              ? {
                  ...employee,
                  hourlyRate: rate,
                }
              : employee,
          ),
        })),
      createEmployee: async (input) => {
        if (!input.fullName.trim()) {
          return {
            ok: false,
            reason: 'Укажите имя сотрудника',
          };
        }

        if (!isValidPinFormat(input.pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        const { hash, salt } = await createPinCredentials(input.pin);

        set((state) => ({
          employees: [
            {
              id: crypto.randomUUID(),
              fullName: input.fullName.trim(),
              role: input.role,
              positionTitle:
                input.positionTitle?.trim() || getDefaultPositionTitle(input.role),
              pinHash: hash,
              pinSalt: salt,
              isActive: true,
              createdAt: new Date().toISOString(),
              department: getDefaultDepartment(input.role),
              hourlyRate:
                input.role === 'chef' ? input.hourlyRate ?? null : getPresetRate(input.role),
            },
            ...state.employees,
          ],
        }));

        return { ok: true };
      },
      updateEmployee: (employeeId, updates) => {
        const state = get();
        const employee = state.employees.find((item) => item.id === employeeId);

        if (!employee) {
          return {
            ok: false,
            reason: 'Сотрудник не найден',
          };
        }

        const nextRole = updates.role ?? employee.role;
        const nextIsActive = updates.isActive ?? employee.isActive;
        const activeOwners = state.employees.filter(
          (item) => item.role === 'owner' && item.isActive,
        );

        if (
          employee.role === 'owner' &&
          (!nextIsActive || nextRole !== 'owner') &&
          activeOwners.length <= 1
        ) {
          return {
            ok: false,
            reason: 'Нужен минимум один активный owner',
          };
        }

        set((current) => ({
          employees: current.employees.map((item) =>
            item.id === employeeId
              ? {
                  ...item,
                  ...updates,
                  role: nextRole,
                  department: getDefaultDepartment(nextRole),
                  positionTitle:
                    updates.positionTitle?.trim() ||
                    item.positionTitle ||
                    getDefaultPositionTitle(nextRole),
                  hourlyRate:
                    nextRole === 'chef' || nextRole === 'owner'
                      ? updates.hourlyRate ?? item.hourlyRate
                      : getPresetRate(nextRole),
                }
              : item,
          ),
          session:
            !nextIsActive && current.session.employeeId === employeeId
              ? {
                  ...current.session,
                  isAuthenticated: false,
                  employeeId: null,
                  lastAuthAt: null,
                }
              : current.session,
        }));

        return { ok: true };
      },
      resetEmployeePin: async (employeeId, pin) => {
        if (!isValidPinFormat(pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        const { hash, salt } = await createPinCredentials(pin);

        set((state) => ({
          employees: state.employees.map((employee) =>
            employee.id === employeeId
              ? {
                  ...employee,
                  pinHash: hash,
                  pinSalt: salt,
                }
              : employee,
          ),
        }));

        return { ok: true };
      },
      deactivateEmployee: (employeeId) =>
        get().updateEmployee(employeeId, { isActive: false }),
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
        const currentEmployee = getCurrentEmployee(state);

        if (!currentEmployee) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        const activeEntry = getCurrentActiveEntry(state);
        if (activeEntry) {
          return {
            ok: false,
            reason: 'У вас уже есть активная смена',
          };
        }

        const startAt = payload?.now ?? new Date().toISOString();
        const earlyStart = isBeforeShiftStart(new Date(startAt));
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
              userId: currentEmployee.id,
              role: currentEmployee.role,
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
        const activeEntry = getCurrentActiveEntry(state);

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
      resetDemo: () => set(normalizeState(cloneInitialState())),
    }),
    {
      name: storageKey,
      version: 3,
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeState({
          ...(currentState as unknown as AppState),
          ...(persistedState as Partial<AppState>),
        } as AppState),
      }),
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

export const getRoleLabel = (role: EmployeeRole) => {
  const labels: Record<EmployeeRole, string> = {
    waiter: 'Официант',
    bartender: 'Бармен',
    chef: 'Повар',
    owner: 'Owner / Admin',
  };

  return labels[role];
};

export const getCurrentEmployee = (state: Store) =>
  state.employees.find((employee) => employee.id === state.session.employeeId) ?? null;

export const getCurrentEmployeeRole = (state: Store) =>
  getCurrentEmployee(state)?.role ?? null;

export const getCurrentActiveEntry = (state: Store) => {
  const employee = getCurrentEmployee(state);

  if (!employee) {
    return null;
  }

  return (
    state.timeEntries.find((entry) => entry.userId === employee.id && !entry.endAt) ?? null
  );
};

export const getActiveEmployees = (state: Store) =>
  state.employees.filter((employee) => employee.isActive);

export const getArchivedEmployees = (state: Store) =>
  state.employees.filter((employee) => !employee.isActive);

export const getEmployeesWithPins = (state: Store) =>
  state.employees.filter((employee) => employee.isActive && Boolean(employee.pinHash));

export const getOwnerWithoutPin = (state: Store) =>
  state.employees.find((employee) => employee.role === 'owner' && !employee.pinHash) ?? null;

export const getProfileRate = (employee: Employee | null) =>
  employee ? resolveHourlyRate(employee) : null;

export const getEntriesHours = (entries: TimeEntry[], now = new Date()) =>
  entries.reduce((sum, entry) => sum + durationHours(entry.startAt, entry.endAt, now), 0);

export const getEntriesForPeriod = (
  entries: TimeEntry[],
  period: TimesheetPeriod,
  now = new Date(),
) => getPeriodEntries(entries, period, now);

export const getEntryEarnings = (
  entries: TimeEntry[],
  employee: Employee | null,
  now = new Date(),
) => calcEarnings(entries, getProfileRate(employee), now);

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
  const filteredEmployees = state.employees.filter((employee) => {
    if (!employee.isActive) {
      return false;
    }

    if (filters.department !== 'all' && employee.department !== filters.department) {
      return false;
    }

    if (filters.userId !== 'all' && employee.id !== filters.userId) {
      return false;
    }

    return true;
  });

  const rows = filteredEmployees
    .map((employee) => {
      const entries = periodEntries.filter((entry) => entry.userId === employee.id);
      const hours = getEntriesHours(entries, now);
      const earnings = calcEarnings(entries, resolveHourlyRate(employee), now);

      return {
        employee,
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

export const getVisibleStageKeys = (role: EmployeeRole | null): StageKey[] => {
  if (role === 'owner' || role === 'chef') {
    return ['leftovers', 'losses', 'handoff', 'closingPhotos'];
  }

  if (role === 'bartender') {
    return ['losses', 'handoff', 'closingPhotos'];
  }

  return ['losses', 'closingPhotos'];
};

export const formatHoursValue = (hours: number) =>
  formatDuration(Number(hours.toFixed(2)));
