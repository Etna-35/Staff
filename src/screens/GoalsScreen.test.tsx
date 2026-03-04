import { fireEvent, render, screen } from '@testing-library/react';
import { mockState } from '../data/mock';
import type { Employee, GoalsState, SessionState } from '../types/domain';
import { GoalsScreen } from './GoalsScreen';

type GoalsStoreMockState = {
  session: SessionState;
  goals: GoalsState;
  goalsLoading: boolean;
  goalsError: string | null;
  goalsSyncDisabled: boolean;
  loadGoals: ReturnType<typeof vi.fn>;
  completeTask: ReturnType<typeof vi.fn>;
  setGoalPeriod: ReturnType<typeof vi.fn>;
};

const storeBridge = vi.hoisted(() => {
  const loadGoalsMock = vi.fn().mockResolvedValue(undefined);
  const completeTaskMock = vi.fn().mockResolvedValue({ ok: true });
  const setGoalPeriodMock = vi.fn().mockResolvedValue({ ok: true });
  const defaultEmployee: Employee = {
    id: 'emp-masha',
    fullName: 'Маша',
    role: 'waiter',
    positionTitle: 'Официант',
    hasPin: true,
    isActive: true,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    department: 'hall',
    hourlyRate: 250,
  };
  const defaultGoals: GoalsState = {
    activePeriod: null,
    metric: null,
    tasks: [],
    contributions: {
      waiters: { department: 'waiters', pointsEarned: 0, percent: 0, lastUpdatedAt: null },
      bar: { department: 'bar', pointsEarned: 0, percent: 0, lastUpdatedAt: null },
      kitchen: { department: 'kitchen', pointsEarned: 0, percent: 0, lastUpdatedAt: null },
      hookah: { department: 'hookah', pointsEarned: 0, percent: 0, lastUpdatedAt: null },
      other: { department: 'other', pointsEarned: 0, percent: 0, lastUpdatedAt: null },
    },
    viewerEmployeeId: 'emp-masha',
  };

  return {
    loadGoalsMock,
    completeTaskMock,
    setGoalPeriodMock,
    mockStoreState: {
      session: {
        bootstrapped: true,
        token: 'token',
        me: defaultEmployee,
      },
      goals: defaultGoals,
      goalsLoading: false,
      goalsError: null as string | null,
      goalsSyncDisabled: false,
      loadGoals: loadGoalsMock,
      completeTask: completeTaskMock,
      setGoalPeriod: setGoalPeriodMock,
    } as GoalsStoreMockState,
  };
});

vi.mock('../store/useAppStore', () => ({
  getCurrentEmployee: (state: GoalsStoreMockState) => state.session.me,
  useAppStore: (selector?: (state: GoalsStoreMockState) => unknown) =>
    selector ? selector(storeBridge.mockStoreState) : storeBridge.mockStoreState,
}));

describe('GoalsScreen', () => {
  const setBaseState = () => {
    storeBridge.mockStoreState = {
      session: {
        bootstrapped: true,
        token: 'token',
        me: {
          id: 'emp-masha',
          fullName: 'Маша',
          role: 'waiter',
          positionTitle: 'Официант',
          hasPin: true,
          isActive: true,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
          department: 'hall',
          hourlyRate: 250,
        },
      },
      goals: {
        ...mockState.goals,
        viewerEmployeeId: 'emp-masha',
      },
      goalsLoading: false,
      goalsError: null,
      goalsSyncDisabled: false,
      loadGoals: storeBridge.loadGoalsMock,
      completeTask: storeBridge.completeTaskMock,
      setGoalPeriod: storeBridge.setGoalPeriodMock,
    };
    storeBridge.loadGoalsMock.mockClear();
    storeBridge.completeTaskMock.mockClear();
    storeBridge.setGoalPeriodMock.mockClear();
  };

  it('renders loading state with existing goal shell', () => {
    setBaseState();
    storeBridge.mockStoreState = {
      ...storeBridge.mockStoreState,
      goalsLoading: true,
    };

    render(<GoalsScreen />);

    expect(screen.getByText('Цель периода')).toBeInTheDocument();
    expect(screen.getByText('Обновляем')).toBeInTheDocument();
  });

  it('renders offline banner and disables completion button', () => {
    setBaseState();
    storeBridge.mockStoreState = {
      ...storeBridge.mockStoreState,
      goalsError: 'Показываем сохраненные данные.',
      goalsSyncDisabled: true,
    };

    render(<GoalsScreen />);

    expect(screen.getByText('Показываем сохраненные данные.')).toBeInTheDocument();
    screen.getAllByRole('button', { name: 'Добавить +1' }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('switches task tabs and shows visible role tasks', () => {
    setBaseState();

    render(<GoalsScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'По должности' }));

    expect(screen.getByText('Апселл на десерт')).toBeInTheDocument();
    expect(screen.queryByText('Чистый бар без хвостов')).not.toBeInTheDocument();
  });
});
