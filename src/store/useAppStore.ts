import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiClient, ApiError } from '../api/client';
import { mockState } from '../data/mock';
import {
  applyGoalTaskProgress,
  createEmptyGoalContributions,
  normalizeGoalContributions,
} from '../lib/goals';
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
  isBeforeShiftStart,
  resolveHourlyRate,
} from '../lib/timeTracking';
import type {
  AppState,
  BonusAward,
  Department,
  DailyBusinessMetric,
  Employee,
  EmployeeRole,
  GoalContribution,
  GoalMetric,
  GoalPeriod,
  GoalPeriodType,
  GoalTask,
  HandoffArea,
  RequestCategory,
  SpecialStarAward,
  ShiftMood,
  ShiftReflection,
  ShiftReflectionPeriod,
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
  requestMode?: 'manual' | 'catalog';
  quantity?: number;
  unit?: string;
  weeklyNorm?: number;
  step?: number;
  subgroup?: string;
};

type EmployeeDraft = {
  fullName: string;
  role: Exclude<EmployeeRole, 'owner'>;
  positionTitle?: string;
  pin: string;
  hourlyRate?: number | null;
  tenureLabel?: string;
};

type TaskDraft = {
  title: string;
  assigneeId: string | null;
  assigneeName: string;
  points: number;
  rewardAmount?: number;
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

type RevenueGoalsInput = {
  weeklyRevenueTarget: number | null;
  monthlyRevenueTarget: number | null;
  monthlyAverageCheckStart: number | null;
  monthlyAverageCheckTarget: number | null;
};

type GoalSettingsInput = {
  type: GoalPeriodType;
  targetValue: number;
  title?: string;
  unit?: string;
  label?: string;
  resetProgress?: boolean;
};

type DailyBusinessMetricInput = {
  dateKey: string;
  revenueActual: number | null;
  averageCheckTarget: number | null;
  averageCheckActual: number | null;
};

type ShiftReflectionInput = {
  dateKey: string;
  mood: ShiftMood;
  starRecipientId?: string | null;
};

type Store = AppState & {
  employeesLoading: boolean;
  loginEmployeesLoading: boolean;
  shiftReflectionsLoading: boolean;
  specialStarAwardsLoading: boolean;
  bonusAwardsLoading: boolean;
  goalsLoading: boolean;
  goalsSyncDisabled: boolean;
  goalsError: string | null;
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
  createTask: (input: TaskDraft) => void;
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
  loadShiftReflections: (payload: {
    period: ShiftReflectionPeriod;
    dateKey: string;
  }) => Promise<void>;
  submitShiftReflection: (input: ShiftReflectionInput) => Promise<ActionResult>;
  loadSpecialStarAwards: (payload: {
    period: ShiftReflectionPeriod;
    dateKey: string;
  }) => Promise<void>;
  grantSpecialStar: (input: {
    employeeId: string;
    dateKey: string;
  }) => Promise<ActionResult>;
  loadBonusAwards: (payload: {
    period: ShiftReflectionPeriod;
    dateKey: string;
  }) => Promise<void>;
  grantBonusAward: (input: {
    employeeId: string;
    dateKey: string;
    amount: number;
    note?: string | null;
  }) => Promise<ActionResult>;
  deleteBonusAward: (input: {
    awardId: string;
    dateKey: string;
  }) => Promise<ActionResult>;
  loadGoals: () => Promise<void>;
  completeTask: (taskId: string, delta?: number) => Promise<ActionResult>;
  setGoalPeriod: (input: GoalSettingsInput) => Promise<ActionResult>;
  saveRevenueGoals: (input: RevenueGoalsInput) => ActionResult;
  saveDailyBusinessMetric: (input: DailyBusinessMetricInput) => ActionResult;
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
  | 'revenueGoals'
  | 'dailyBusinessMetrics'
  | 'goals'
  | 'session'
>;

const storageKey = 'restaurant-os-mvp';

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const getPersistStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  if (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    typeof globalThis.localStorage?.getItem === 'function' &&
    typeof globalThis.localStorage?.setItem === 'function'
  ) {
    return globalThis.localStorage;
  }

  return noopStorage;
};

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
  shiftReflections: state.shiftReflections ?? [],
  specialStarAwards: state.specialStarAwards ?? [],
  bonusAwards: state.bonusAwards ?? [],
  goals: {
    activePeriod: state.goals?.activePeriod ?? null,
    metric: state.goals?.metric ?? null,
    tasks: state.goals?.tasks ?? [],
    contributions: normalizeGoalContributions(
      state.goals?.contributions ?? createEmptyGoalContributions(),
    ),
    viewerEmployeeId: state.goals?.viewerEmployeeId ?? null,
  },
  revenueGoals: {
    weeklyRevenueTarget: state.revenueGoals?.weeklyRevenueTarget ?? null,
    monthlyRevenueTarget: state.revenueGoals?.monthlyRevenueTarget ?? null,
    monthlyAverageCheckStart: state.revenueGoals?.monthlyAverageCheckStart ?? null,
    monthlyAverageCheckTarget: state.revenueGoals?.monthlyAverageCheckTarget ?? null,
  },
  dailyBusinessMetrics: state.dailyBusinessMetrics ?? [],
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

const sortDailyBusinessMetrics = (metrics: DailyBusinessMetric[]) =>
  [...metrics].sort((left, right) => right.dateKey.localeCompare(left.dateKey));

const sortShiftReflections = (reflections: ShiftReflection[]) =>
  [...reflections].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

const sortSpecialStarAwards = (awards: SpecialStarAward[]) =>
  [...awards].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const sortBonusAwards = (awards: BonusAward[]) =>
  [...awards].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const mergeGoalsState = ({
  activePeriod,
  metric,
  tasks,
  contributions,
  viewerEmployeeId,
}: {
  activePeriod?: GoalPeriod | null;
  metric?: GoalMetric | null;
  tasks?: GoalTask[];
  contributions?: Record<Department, GoalContribution>;
  viewerEmployeeId?: string | null;
}) => ({
  activePeriod: activePeriod ?? null,
  metric: metric ?? null,
  tasks: tasks ?? [],
  contributions: normalizeGoalContributions(
    contributions ?? createEmptyGoalContributions(),
  ),
  viewerEmployeeId: viewerEmployeeId ?? null,
});

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...normalizeState(cloneInitialState()),
      employeesLoading: false,
      loginEmployeesLoading: false,
      shiftReflectionsLoading: false,
      specialStarAwardsLoading: false,
      bonusAwardsLoading: false,
      goalsLoading: false,
      goalsSyncDisabled: false,
      goalsError: null,
      authError: null,
      setTelegramName: (name) => set({ telegramName: name }),
      clearAuthError: () => set({ authError: null }),
      loadBootstrapStatus: async () => {
        set({ authError: null, goalsError: null });

        try {
          const { bootstrapped } = await apiClient.getBootstrapStatus();

          set((state) => ({
            authError: null,
            session: {
              ...state.session,
              bootstrapped,
              ...(bootstrapped ? {} : { token: null, me: null }),
            },
            shiftReflections: bootstrapped ? state.shiftReflections : [],
            specialStarAwards: bootstrapped ? state.specialStarAwards : [],
            bonusAwards: bootstrapped ? state.bonusAwards : [],
            goals: bootstrapped
              ? state.goals
              : mergeGoalsState({
                  activePeriod: state.goals.activePeriod,
                  metric: state.goals.metric,
                  contributions: state.goals.contributions,
                }),
            goalsSyncDisabled: false,
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
            goalsError: null,
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
            shiftReflections: [],
            specialStarAwards: [],
            bonusAwards: [],
            goalsSyncDisabled: false,
            goalsError: null,
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
            shiftReflections: [],
            specialStarAwards: [],
            bonusAwards: [],
            goalsSyncDisabled: false,
            goalsError: null,
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
          shiftReflections: [],
          shiftReflectionsLoading: false,
          specialStarAwards: [],
          specialStarAwardsLoading: false,
          bonusAwards: [],
          bonusAwardsLoading: false,
          goalsLoading: false,
          goalsSyncDisabled: false,
          goalsError: null,
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
        const token = getSessionToken(get());
        const state = get();
        const currentMe = getSessionMe(state);

        if (!token || !currentMe) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        try {
          const employee = applyEmployeeShape(
            await apiClient.setMyHourlyRate(
              token,
              {
                hourlyRate: rate,
              },
              () => get().logout(),
            ),
            currentMe,
          );

          set((current) => ({
            authError: null,
            employees: replaceEmployeeInList(current.employees, employee),
            session: {
              ...current.session,
              me: employee,
            },
          }));

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось сохранить ставку',
          };
        }
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
            hourlyRate: input.hourlyRate ?? null,
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
                hourlyRate: input.hourlyRate ?? null,
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
      createTask: ({ title, assigneeId, assigneeName, points, rewardAmount = 0 }) =>
        set((state) => ({
          tasks: sortTasks([
            {
              id: crypto.randomUUID(),
              title,
              assignee: assigneeName,
              assigneeId: assigneeId ?? undefined,
              points,
              rewardAmount: rewardAmount > 0 ? rewardAmount : 0,
              status: 'assigned',
              dueLabel: 'новая задача',
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
      loadShiftReflections: async ({ period, dateKey }) => {
        const token = getSessionToken(get());

        if (!token) {
          set({ shiftReflections: [], shiftReflectionsLoading: false });
          return;
        }

        set({ shiftReflectionsLoading: true });

        try {
          const reflections = await apiClient.getShiftReflections(
            token,
            period,
            dateKey,
            () => get().logout(),
          );

          set({
            authError: null,
            shiftReflections: sortShiftReflections(reflections),
            shiftReflectionsLoading: false,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            return;
          }

          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось загрузить оценки дня.',
            shiftReflectionsLoading: false,
          });
        }
      },
      submitShiftReflection: async (input) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || !currentEmployee) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        try {
          const reflection = await apiClient.submitShiftReflection(
            token,
            input,
            () => get().logout(),
          );

          set((state) => ({
            authError: null,
            shiftReflections: sortShiftReflections([
              reflection,
              ...state.shiftReflections.filter((item) => item.id !== reflection.id),
            ]),
          }));

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError
                ? error.message
                : 'Не удалось сохранить оценку дня',
          };
        }
      },
      loadSpecialStarAwards: async ({ period, dateKey }) => {
        const token = getSessionToken(get());

        if (!token) {
          set({ specialStarAwards: [], specialStarAwardsLoading: false });
          return;
        }

        set({ specialStarAwardsLoading: true });

        try {
          const awards = await apiClient.getSpecialStarAwards(
            token,
            period,
            dateKey,
            () => get().logout(),
          );

          set({
            authError: null,
            specialStarAwards: sortSpecialStarAwards(awards),
            specialStarAwardsLoading: false,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            return;
          }

          set({
            authError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось загрузить особые звезды.',
            specialStarAwardsLoading: false,
          });
        }
      },
      grantSpecialStar: async (input) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!input.employeeId) {
          return {
            ok: false,
            reason: 'Выберите сотрудника',
          };
        }

        try {
          const award = await apiClient.grantSpecialStar(token, input, () => get().logout());

          set((state) => ({
            authError: null,
            specialStarAwards: sortSpecialStarAwards([award, ...state.specialStarAwards]),
          }));

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError
                ? error.message
                : 'Не удалось выдать особую звезду',
          };
        }
      },
      loadBonusAwards: async ({ period, dateKey }) => {
        const token = getSessionToken(get());

        if (!token) {
          set({ bonusAwards: [], bonusAwardsLoading: false });
          return;
        }

        set({ bonusAwardsLoading: true });

        try {
          const awards = await apiClient.getBonusAwards(token, period, dateKey, () =>
            get().logout(),
          );

          set({
            authError: null,
            bonusAwards: sortBonusAwards(awards),
            bonusAwardsLoading: false,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            return;
          }

          set({
            authError:
              error instanceof ApiError ? error.message : 'Не удалось загрузить премии.',
            bonusAwardsLoading: false,
          });
        }
      },
      grantBonusAward: async (input) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!input.employeeId) {
          return {
            ok: false,
            reason: 'Выберите сотрудника',
          };
        }

        if (!(input.amount > 0)) {
          return {
            ok: false,
            reason: 'Укажите сумму премии',
          };
        }

        try {
          const award = await apiClient.grantBonusAward(token, input, () => get().logout());

          set((state) => ({
            authError: null,
            bonusAwards: sortBonusAwards([award, ...state.bonusAwards]),
          }));

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось выдать премию',
          };
        }
      },
      deleteBonusAward: async ({ awardId, dateKey }) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!awardId || !dateKey) {
          return {
            ok: false,
            reason: 'Не удалось определить премию',
          };
        }

        try {
          await apiClient.deleteBonusAward(token, awardId, dateKey, () => get().logout());

          set((state) => ({
            authError: null,
            bonusAwards: state.bonusAwards.filter((award) => award.id !== awardId),
          }));

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось удалить премию',
          };
        }
      },
      loadGoals: async () => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || !currentEmployee) {
          set({
            goalsLoading: false,
            goalsSyncDisabled: true,
            goalsError: 'Нужна активная сессия сотрудника.',
            goals: mergeGoalsState({
              activePeriod: get().goals.activePeriod,
              metric: get().goals.metric,
              contributions: get().goals.contributions,
            }),
          });
          return;
        }

        set({ goalsLoading: true, goalsError: null });

        try {
          const payload = await apiClient.getGoalsActive(token, () => get().logout());

          set({
            authError: null,
            goalsLoading: false,
            goalsSyncDisabled: false,
            goalsError: null,
            goals: mergeGoalsState({
              activePeriod: payload.activePeriod,
              metric: payload.metric,
              tasks: payload.tasks,
              contributions: payload.contributions,
              viewerEmployeeId: currentEmployee.id,
            }),
          });
        } catch (error) {
          const cachedGoals = get().goals;
          const canReuseCachedTasks = cachedGoals.viewerEmployeeId === currentEmployee.id;

          set({
            goalsLoading: false,
            goalsSyncDisabled: true,
            goalsError:
              error instanceof ApiError
                ? error.message
                : 'Нет связи с общей целью. Показываем сохраненные данные.',
            goals: mergeGoalsState({
              activePeriod: cachedGoals.activePeriod,
              metric: cachedGoals.metric,
              tasks: canReuseCachedTasks ? cachedGoals.tasks : [],
              contributions: cachedGoals.contributions,
              viewerEmployeeId: currentEmployee.id,
            }),
          });
        }
      },
      completeTask: async (taskId, delta = 1) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());
        const state = get();

        if (!token || !currentEmployee) {
          return {
            ok: false,
            reason: 'Сначала войдите по PIN',
          };
        }

        if (state.goalsSyncDisabled) {
          return {
            ok: false,
            reason: 'Сейчас нет связи. Показываем кэш, синхронизация временно недоступна.',
          };
        }

        const currentGoals = state.goals;
        const optimistic = applyGoalTaskProgress(
          currentGoals.tasks,
          currentGoals.contributions,
          currentGoals.metric,
          taskId,
          delta,
        );

        if (!optimistic.task) {
          return {
            ok: false,
            reason: 'Задача не найдена',
          };
        }

        set({
          goals: mergeGoalsState({
            activePeriod: currentGoals.activePeriod,
            metric: optimistic.metric,
            tasks: optimistic.tasks,
            contributions: optimistic.contributions,
            viewerEmployeeId: currentGoals.viewerEmployeeId,
          }),
        });

        try {
          const payload = await apiClient.progressGoalTask(token, taskId, delta, () =>
            get().logout(),
          );

          set((nextState) => ({
            authError: null,
            goalsSyncDisabled: false,
            goalsError: null,
            goals: mergeGoalsState({
              activePeriod: nextState.goals.activePeriod,
              metric: payload.metric,
              tasks: nextState.goals.tasks.map((task) =>
                task.id === payload.task.id ? payload.task : task,
              ),
              contributions: payload.contributions,
              viewerEmployeeId: nextState.goals.viewerEmployeeId,
            }),
          }));

          return { ok: true };
        } catch (error) {
          set({
            goals: currentGoals,
            goalsSyncDisabled: true,
            goalsError:
              error instanceof ApiError
                ? error.message
                : 'Не удалось синхронизировать выполнение задачи.',
          });

          return {
            ok: false,
            reason:
              error instanceof ApiError
                ? error.message
                : 'Не удалось синхронизировать выполнение задачи.',
          };
        }
      },
      setGoalPeriod: async (input) => {
        const token = getSessionToken(get());
        const currentEmployee = getSessionMe(get());

        if (!token || currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!(input.targetValue > 0)) {
          return {
            ok: false,
            reason: 'Укажите цель больше нуля',
          };
        }

        try {
          const payload = await apiClient.setActiveGoal(
            token,
            {
              ...input,
            },
            () => get().logout(),
          );

          set({
            authError: null,
            goalsSyncDisabled: false,
            goalsError: null,
            goals: mergeGoalsState({
              activePeriod: payload.activePeriod,
              metric: payload.metric,
              tasks: payload.tasks,
              contributions: payload.contributions,
              viewerEmployeeId: currentEmployee.id,
            }),
          });

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof ApiError ? error.message : 'Не удалось обновить цель периода',
          };
        }
      },
      saveRevenueGoals: (input) => {
        const currentEmployee = getCurrentEmployee(get());

        if (currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        set({
          revenueGoals: {
            weeklyRevenueTarget:
              input.weeklyRevenueTarget && input.weeklyRevenueTarget > 0
                ? input.weeklyRevenueTarget
                : null,
            monthlyRevenueTarget:
              input.monthlyRevenueTarget && input.monthlyRevenueTarget > 0
                ? input.monthlyRevenueTarget
                : null,
            monthlyAverageCheckStart:
              input.monthlyAverageCheckStart && input.monthlyAverageCheckStart > 0
                ? input.monthlyAverageCheckStart
                : null,
            monthlyAverageCheckTarget:
              input.monthlyAverageCheckTarget && input.monthlyAverageCheckTarget > 0
                ? input.monthlyAverageCheckTarget
                : null,
          },
        });

        return { ok: true };
      },
      saveDailyBusinessMetric: (input) => {
        const currentEmployee = getCurrentEmployee(get());

        if (currentEmployee?.role !== 'owner') {
          return {
            ok: false,
            reason: 'Нужен owner-доступ',
          };
        }

        if (!input.dateKey) {
          return {
            ok: false,
            reason: 'Нужна дата',
          };
        }

        const nextMetric: DailyBusinessMetric = {
          dateKey: input.dateKey,
          revenueActual:
            input.revenueActual && input.revenueActual > 0 ? input.revenueActual : null,
          averageCheckTarget:
            input.averageCheckTarget && input.averageCheckTarget > 0
              ? input.averageCheckTarget
              : null,
          averageCheckActual:
            input.averageCheckActual && input.averageCheckActual > 0
              ? input.averageCheckActual
              : null,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          dailyBusinessMetrics: sortDailyBusinessMetrics(
            state.dailyBusinessMetrics.some((metric) => metric.dateKey === input.dateKey)
              ? state.dailyBusinessMetrics.map((metric) =>
                  metric.dateKey === input.dateKey ? nextMetric : metric,
                )
              : [nextMetric, ...state.dailyBusinessMetrics],
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
          shiftReflectionsLoading: false,
          specialStarAwardsLoading: false,
          bonusAwardsLoading: false,
          goalsLoading: false,
          goalsSyncDisabled: false,
          goalsError: null,
        })),
    }),
    {
      name: storageKey,
      version: 9,
      storage: createJSONStorage(getPersistStorage),
      migrate: (persistedState) => persistedState as PersistedStoreSlice,
      partialize: (state): PersistedStoreSlice => ({
        telegramName: state.telegramName,
        shift: state.shift,
        tasks: state.tasks,
        losses: state.losses,
        handoffItems: state.handoffItems,
        requests: state.requests,
        timeEntries: state.timeEntries,
        revenueGoals: state.revenueGoals,
        dailyBusinessMetrics: state.dailyBusinessMetrics,
        goals: state.goals,
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
          revenueGoals: persisted.revenueGoals ?? baseState.revenueGoals,
          dailyBusinessMetrics:
            persisted.dailyBusinessMetrics ?? baseState.dailyBusinessMetrics,
          goals: persisted.goals ?? baseState.goals,
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
          shiftReflectionsLoading: false,
          specialStarAwardsLoading: false,
          bonusAwardsLoading: false,
          goalsLoading: false,
          goalsSyncDisabled: false,
          goalsError: null,
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

const normalizeTaskAssignee = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

export const isTaskAssignedToEmployee = (task: Task, employee: Employee | null) => {
  if (!employee) {
    return false;
  }

  if (task.assigneeId) {
    return task.assigneeId === employee.id;
  }

  return normalizeTaskAssignee(task.assignee) === normalizeTaskAssignee(employee.fullName);
};

export const getTasksForEmployee = (tasks: Task[], employee: Employee | null) =>
  tasks.filter((task) => isTaskAssignedToEmployee(task, employee));

export const getAcceptedTaskRewardTotal = (tasks: Task[], employee: Employee | null) =>
  tasks
    .filter((task) => task.status === 'accepted' && isTaskAssignedToEmployee(task, employee))
    .reduce((sum, task) => sum + (task.rewardAmount ?? 0), 0);

export const getEntriesHours = (entries: TimeEntry[], now = new Date()) =>
  entries.reduce((sum, entry) => sum + durationHours(entry.startAt, entry.endAt, now), 0);

export const getEntriesForPeriod = (
  entries: TimeEntry[],
  period: TimesheetPeriod,
  now = new Date(),
) => getPeriodEntries(entries, period, now);

export const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const getShiftReflectionsForDate = (
  reflections: ShiftReflection[],
  dateKey: string,
) => reflections.filter((reflection) => reflection.dateKey === dateKey);

export const getEmployeeReflectionForDate = (
  reflections: ShiftReflection[],
  employeeId: string,
  dateKey: string,
) =>
  reflections.find(
    (reflection) =>
      reflection.employeeId === employeeId && reflection.dateKey === dateKey,
  ) ?? null;

export const getReceivedStarsCount = (
  reflections: ShiftReflection[],
  employeeId: string,
) =>
  reflections.filter((reflection) => reflection.starRecipientId === employeeId).length;

export const getReceivedSpecialStarsCount = (
  awards: SpecialStarAward[],
  employeeId: string,
) => awards.filter((award) => award.employeeId === employeeId).length;

export const getBonusAwardsTotal = (awards: BonusAward[], employeeId: string) =>
  awards
    .filter((award) => award.employeeId === employeeId)
    .reduce((sum, award) => sum + award.amount, 0);

const getPeriodBounds = (period: TimesheetPeriod, now = new Date()) => {
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const getDailyBusinessMetricForDate = (
  metrics: DailyBusinessMetric[],
  dateKey: string,
) => metrics.find((metric) => metric.dateKey === dateKey) ?? null;

export const getDailyBusinessMetricsForPeriod = (
  metrics: DailyBusinessMetric[],
  period: TimesheetPeriod,
  now = new Date(),
) => {
  const { start, end } = getPeriodBounds(period, now);

  return metrics.filter((metric) => {
    const metricDate = new Date(`${metric.dateKey}T12:00:00`);

    return metricDate >= start && metricDate <= end;
  });
};

export const getRevenueActualForPeriod = (
  metrics: DailyBusinessMetric[],
  period: TimesheetPeriod,
  now = new Date(),
) =>
  getDailyBusinessMetricsForPeriod(metrics, period, now).reduce(
    (sum, metric) => sum + (metric.revenueActual ?? 0),
    0,
  );

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
