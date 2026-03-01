import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mockState } from '../data/mock';
import type {
  AppState,
  HandoffArea,
  RequestCategory,
  Role,
  StageKey,
  Task,
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
    (set) => ({
      ...cloneInitialState(),
      setTelegramName: (name) => set({ telegramName: name }),
      setRole: (role) => set({ role }),
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

