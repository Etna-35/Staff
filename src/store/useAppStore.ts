import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiClient, ApiError } from '../api/client';
import { mockState } from '../data/mock';
import { isValidPinFormat } from '../lib/pinAuth';
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
  tenureLabel?: string;
};

type EmployeeUpdate = {
  fullName?: string;
  role?: EmployeeRole;
  positionTitle?: string;
  isActive?: boolean;
  hourlyRate?: number | null;
  tenureLabel?: string | null;
};

type ActionResult = {
  ok: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
};

type Store = AppState & {
  employeesLoading: boolean;
  loginEmployeesLoading: boolean;
  authError: string | null;
  setTelegramName: (name: string) => void;
  clearAuthError: () => void;
  loadBootstrapStatus: () => Promise<void>;
  loadMe: () => Promise<void>;
  refreshLoginEmployees: () => Promise<void>;
  bootstrapOwner: (fullName: string, pin: string) => Promise<ActionResult>;
  loginWithPin: (employeeId: string, pin: string) => Promise<ActionResult>;
  logout: () => void;
  loadEmployees: () => Promise<void>;
  setHourlyRate: (rate: number | null) => Promise<ActionResult>;
  changeMyPin: (currentPin: string, newPin: string) => Promise<ActionResult>;
  createEmployee: (input: EmployeeDraft) => Promise<ActionResult>;
  updateEmployee: (employeeId: string, updates: EmployeeUpdate) => Promise<ActionResult>;
  resetEmployeePin: (employeeId: string, pin: string) => Promise<ActionResult>;
  deactivateEmployee: (employeeId: string) => Promise<ActionResult>;
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

type PersistedStoreSlice = Pick<
  Store,
  | 'telegramName'
  | 'shift'
  | 'tasks'
  | 'losses'
  | 'handoffItems'
  | 'requests'
  | 'timeEntries'
  | 'session'
>;

const storageKey = 'restaurant-os-mvp';

const cloneInitialState = (): AppState =>
  JSON.parse(JSON.stringify(mockState)) as AppState;

const createAnonymousSession = (
  overrides: Partial<Store['session']> = {},
): Store['session'] => ({
  bootstrapped: null,
  token: null,
  me: null,
  ...overrides,
});

const normalizeState = (state: AppState): AppState => ({
  ...state,
  telegramName: state.telegramName || 'Гость смены',
  employees: state.employees ?? [],
  loginEmployees: state.loginEmployees ?? [],
  session: createAnonymousSession({
    bootstrapped: state.session?.bootstrapped ?? null,
    token: state.session?.token ?? null,
    me: state.session?.me ?? null,
  }),
});

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

type EmployeeShapeInput = Partial<Employee> &
  Pick<Employee, 'id' | 'fullName' | 'role' | 'positionTitle' | 'isActive'>;

const applyEmployeeShape = (
  employee: EmployeeShapeInput,
  fallback?: Partial<Employee>,
): Employee => {
  const createdAt = employee.createdAt ?? fallback?.createdAt ?? new Date().toISOString();
  const role = employee.role ?? fallback?.role ?? 'waiter';

  return {
    id: employee.id,
    fullName: employee.fullName ?? fallback?.fullName ?? 'Сотрудник',
    role,
    positionTitle:
      employee.positionTitle ??
      fallback?.positionTitle ??
      getDefaultPositionTitle(role),
    hasPin: employee.hasPin ?? fallback?.hasPin ?? true,
    isActive: employee.isActive ?? fallback?.isActive ?? true,
    createdAt,
    updatedAt: employee.updatedAt ?? fallback?.updatedAt ?? createdAt,
    department: employee.department ?? fallback?.department ?? getDefaultDepartment(role),
    hourlyRate: employee.hourlyRate ?? fallback?.hourlyRate ?? null,
    tenureLabel: employee.tenureLabel ?? fallback?.tenureLabel,
  };
};

const replaceEmployeeInList = (employees: Employee[], nextEmployee: Employee) => {
  const normalizedEmployee = applyEmployeeShape(nextEmployee);
  const nextList = employees.some((employee) => employee.id === normalizedEmployee.id)
    ? employees.map((employee) =>
        employee.id === normalizedEmployee.id ? normalizedEmployee : employee,
      )
    : [normalizedEmployee, ...employees];

  return nextList.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const getSessionToken = (state: Store) => state.session.token;
const getSessionMe = (state: Store) => state.session.me;

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...normalizeState(cloneInitialState()),
      employeesLoading: false,
      loginEmployeesLoading: false,
      authError: null,
      setTelegramName: (name) => set({ telegramName: name }),
      clearAuthError: () => set({ authError: null }),
      loadBootstrapStatus: async () => {
        set({ authError: null });

        try {
          const { bootstrapped } = await apiClient.getBootstrapStatus();

          set((state) => ({
            authError: null,
            session: {
              ...state.session,
              bootstrapped,
              ...(bootstrapped ? {} : { token: null, me: null }),
            },
          }));

          if (bootstrapped) {
            await get().refreshLoginEmployees().catch(() => undefined);
          }
        } catch (error) {
          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось подключиться к серверу доступа.',
          });
        }
      },
      loadMe: async () => {
        const token = getSessionToken(get());

        if (!token) {
          set((state) => ({
            authError: null,
            session: {
              ...state.session,
              me: null,
            },
          }));
          return;
        }

        try {
          const currentMe = getSessionMe(get());
          const me = applyEmployeeShape(await apiClient.getMe(token, () => get().logout()), currentMe ?? undefined);

          set((state) => ({
            authError: null,
            employees:
              me.role === 'owner'
                ? replaceEmployeeInList(state.employees, me)
                : replaceEmployeeInList(
                    state.employees.filter((employee) => employee.id !== me.id),
                    me,
                  ),
            session: {
              ...state.session,
              me,
            },
          }));
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            return;
          }

          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось загрузить профиль сотрудника.',
          });
        }
      },
      refreshLoginEmployees: async () => {
        if (get().session.bootstrapped === false) {
          return;
        }

        set({ loginEmployeesLoading: true });

        try {
          const loginEmployees = await apiClient.getLoginEmployees();

          set({
            authError: null,
            loginEmployees,
            loginEmployeesLoading: false,
          });
        } catch (error) {
          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось загрузить список сотрудников.',
            loginEmployeesLoading: false,
          });
        }
      },
      bootstrapOwner: async (fullName, pin) => {
        if (!isValidPinFormat(pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        try {
          const { sessionToken } = await apiClient.bootstrapOwner({
            fullName: fullName.trim() || 'Юра',
            pin,
          });
          set((state) => ({
            authError: null,
            session: {
              ...state.session,
              bootstrapped: true,
              token: sessionToken,
            },
          }));
          await get().loadMe();
          await get().refreshLoginEmployees().catch(() => undefined);

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError
                ? error.message
                : 'Не удалось создать PIN основателя',
          };
        }
      },
      loginWithPin: async (employeeId, pin) => {
        if (!employeeId) {
          return {
            ok: false,
            reason: 'Выберите сотрудника',
          };
        }

        if (!isValidPinFormat(pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        try {
          const { sessionToken } = await apiClient.login({
            employeeId,
            pin,
          });
          set((state) => ({
            authError: null,
            session: {
              ...state.session,
              bootstrapped: true,
              token: sessionToken,
            },
          }));
          await get().loadMe();

          if (get().session.me?.role === 'owner') {
            await get().loadEmployees();
          }

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof ApiError ? error.message : 'Не удалось войти',
          };
        }
      },
      logout: () => {
        set((state) => ({
          authError: null,
          session: {
            ...state.session,
            token: null,
            me: null,
          },
        }));
      },
      loadEmployees: async () => {
        const token = getSessionToken(get());

        if (!token) {
          set({
            employees: [],
          });
          return;
        }

        set({ employeesLoading: true });

        try {
          const currentMe = getSessionMe(get());
          const employees = await apiClient.getEmployees(token, () => get().logout());

          set((state) => ({
            authError: null,
            employees: employees.map((employee) =>
              applyEmployeeShape(
                employee,
                state.employees.find((item) => item.id === employee.id),
              ),
            ),
            employeesLoading: false,
            session: currentMe
              ? {
                  ...state.session,
                  me: applyEmployeeShape(
                    employees.find((employee) => employee.id === currentMe.id) ?? currentMe,
                    currentMe,
                  ),
                }
              : state.session,
          }));
        } catch (error) {
          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось загрузить список сотрудников.',
            employeesLoading: false,
          });
        }
      },
      setHourlyRate: async (rate) => {
        const state = get();
        const currentMe = getSessionMe(state);

        if (!currentMe) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        const employee = applyEmployeeShape(
          {
            ...currentMe,
            hourlyRate: rate,
          },
          currentMe,
        );

        set((current) => ({
          employees: replaceEmployeeInList(current.employees, employee),
          session: {
            ...current.session,
            me: employee,
          },
        }));

        return { ok: true };
      },
      changeMyPin: async (currentPin, newPin) => {
        const token = getSessionToken(get());

        if (!token || !getSessionMe(get())) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        if (!isValidPinFormat(currentPin)) {
          return {
            ok: false,
            reason: 'Текущий PIN должен быть 4–6 цифр',
          };
        }

        if (!isValidPinFormat(newPin)) {
          return {
            ok: false,
            reason: 'Новый PIN должен быть 4–6 цифр',
          };
        }

        try {
          await apiClient.changeMyPin(
            token,
            {
              currentPin,
              newPin,
            },
            () => get().logout(),
          );

          set({ authError: null });
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof ApiError ? error.message : 'Не удалось сменить PIN',
          };
        }
      },
      createEmployee: async (input) => {
        const token = getSessionToken(get());

        if (!token) {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

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

        try {
          const draftEmployee = applyEmployeeShape({
            id: crypto.randomUUID(),
            fullName: input.fullName.trim(),
            role: input.role,
            positionTitle:
              input.positionTitle?.trim() || getDefaultPositionTitle(input.role),
            isActive: true,
            hourlyRate:
              input.role === 'chef' ? input.hourlyRate ?? null : getPresetRate(input.role),
            tenureLabel: input.tenureLabel?.trim() || undefined,
          });
          const employee = applyEmployeeShape(
            await apiClient.createEmployee(
              token,
              {
                fullName: input.fullName.trim(),
                role: input.role,
                positionTitle:
                  input.positionTitle?.trim() || getDefaultPositionTitle(input.role),
                pin: input.pin,
                hourlyRate:
                  input.role === 'chef' ? input.hourlyRate ?? null : getPresetRate(input.role),
                tenureLabel: input.tenureLabel?.trim() || undefined,
              },
              () => get().logout(),
            ),
            draftEmployee,
          );

          set((state) => ({
            authError: null,
            employees: replaceEmployeeInList(state.employees, employee),
            loginEmployees: [
              {
                id: employee.id,
                fullName: employee.fullName,
                positionTitle: employee.positionTitle,
              },
              ...state.loginEmployees.filter((item) => item.id !== employee.id),
            ],
          }));

          await get().refreshLoginEmployees().catch(() => undefined);
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось создать сотрудника',
          };
        }
      },
      updateEmployee: async (employeeId, updates) => {
        const token = getSessionToken(get());

        if (!token) {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        try {
          const currentEmployee = get().employees.find((employee) => employee.id === employeeId);
          const employee = applyEmployeeShape(
            await apiClient.updateEmployee(
              token,
              employeeId,
              {
                ...updates,
                fullName: updates.fullName?.trim(),
                positionTitle: updates.positionTitle?.trim(),
              },
              () => get().logout(),
            ),
            currentEmployee,
          );

          set((state) => ({
            authError: null,
            employees: replaceEmployeeInList(state.employees, employee),
            session:
              state.session.me?.id === employee.id
                ? {
                    ...state.session,
                    me: employee,
                  }
                : state.session,
          }));

          await get().refreshLoginEmployees().catch(() => undefined);
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось обновить сотрудника',
          };
        }
      },
      resetEmployeePin: async (employeeId, pin) => {
        const token = getSessionToken(get());

        if (!token) {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!isValidPinFormat(pin)) {
          return {
            ok: false,
            reason: 'PIN должен быть 4–6 цифр',
          };
        }

        try {
          await apiClient.resetEmployeePin(token, employeeId, pin, () => get().logout());

          set({ authError: null });

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason: error instanceof ApiError ? error.message : 'Не удалось сбросить PIN',
          };
        }
      },
      deactivateEmployee: async (employeeId) => {
        const token = getSessionToken(get());

        if (!token) {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        try {
          await apiClient.deactivateEmployee(token, employeeId, () => get().logout());

          set((state) => ({
            authError: null,
            employees: state.employees.map((employee) =>
              employee.id === employeeId
                ? {
                    ...employee,
                    isActive: false,
                  }
                : employee,
            ),
          }));

          if (get().session.me?.id === employeeId) {
            get().logout();
          }

          await get().refreshLoginEmployees().catch(() => undefined);
          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось деактивировать сотрудника',
          };
        }
      },
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
      resetDemo: () =>
        set((state) => ({
          ...normalizeState(cloneInitialState()),
          employees: state.employees,
          loginEmployees: state.loginEmployees,
          session: state.session,
          employeesLoading: false,
          loginEmployeesLoading: false,
        })),
    }),
    {
      name: storageKey,
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedStoreSlice => ({
        telegramName: state.telegramName,
        shift: state.shift,
        tasks: state.tasks,
        losses: state.losses,
        handoffItems: state.handoffItems,
        requests: state.requests,
        timeEntries: state.timeEntries,
        session: {
          token: state.session.token,
          bootstrapped: null,
          me: null,
        },
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedStoreSlice>;
        const baseState = currentState as Store;
        const normalized = normalizeState({
          ...cloneInitialState(),
          telegramName: persisted.telegramName ?? baseState.telegramName,
          shift: persisted.shift ?? baseState.shift,
          tasks: persisted.tasks ?? baseState.tasks,
          losses: persisted.losses ?? baseState.losses,
          handoffItems: persisted.handoffItems ?? baseState.handoffItems,
          requests: persisted.requests ?? baseState.requests,
          timeEntries: persisted.timeEntries ?? baseState.timeEntries,
          employees: [],
          loginEmployees: [],
          session: createAnonymousSession({
            token: persisted.session?.token ?? null,
          }),
        });

        return {
          ...baseState,
          ...normalized,
          employeesLoading: false,
          loginEmployeesLoading: false,
          authError: null,
        };
      },
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

export const getCurrentEmployee = (state: Store) => state.session.me ?? null;

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

export const getLoginEmployees = (state: Store) => state.loginEmployees;

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
  const employeeMap = new Map<string, Employee>();

  state.employees.forEach((employee) => {
    employeeMap.set(employee.id, employee);
  });

  if (state.session.me && !employeeMap.has(state.session.me.id)) {
    employeeMap.set(state.session.me.id, state.session.me);
  }

  const filteredEmployees = Array.from(employeeMap.values()).filter((employee) => {
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
