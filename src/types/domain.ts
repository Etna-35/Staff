export type EmployeeRole = 'waiter' | 'bartender' | 'chef' | 'owner';

export type MissionStatus = 'assigned' | 'done' | 'accepted' | 'returned';

export type RequestCategory = 'kitchen' | 'bar' | 'supplies';

export type RequestMode = 'manual' | 'catalog';

export type Criticality = 'high' | 'medium' | 'low';

export type HandoffArea = 'kitchen' | 'bar';

export type StageKey = 'leftovers' | 'losses' | 'handoff' | 'closingPhotos';

export type TeamDepartment = 'kitchen' | 'bar' | 'hall' | 'other';

export type TimesheetPeriod = 'day' | 'week' | 'month';

export type ShiftReflectionPeriod = 'day' | 'week';

export type ShiftMood = 'sad' | 'tired' | 'okay' | 'happy' | 'amazing';

export type Task = {
  id: string;
  title: string;
  assignee: string;
  points: number;
  status: MissionStatus;
  dueLabel: string;
  completedAt?: string;
  acceptedAt?: string;
  returnReason?: string;
};

export type Shift = {
  id: string;
  startedAt: string;
  dayLabel: string;
  leftoversChecked: boolean;
  closingPhotosChecked: boolean;
  closedAt?: string;
};

export type Losses = {
  spoilage: number;
  staffMeal: number;
  rd: number;
  updatedAt?: string;
};

export type HandoffItem = {
  id: string;
  area: HandoffArea;
  title: string;
  criticality: Criticality;
  checked: boolean;
  reason: string;
};

export type Request = {
  id: string;
  category: RequestCategory;
  item: string;
  remaining: string;
  needed: string;
  comment: string;
  requestMode?: RequestMode;
  quantity?: number;
  unit?: string;
  weeklyNorm?: number;
  step?: number;
  subgroup?: string;
  createdAt: string;
};

export type Employee = {
  id: string;
  fullName: string;
  role: EmployeeRole;
  positionTitle: string;
  hasPin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department: TeamDepartment;
  hourlyRate: number | null;
  tenureLabel?: string;
};

export type EmployeeLoginOption = {
  id: string;
  fullName: string;
  positionTitle: string;
};

export type SessionState = {
  bootstrapped: boolean | null;
  token: string | null;
  me: Employee | null;
};

export type TimeEntry = {
  id: string;
  userId: string;
  role: EmployeeRole;
  startAt: string;
  endAt: string | null;
  earlyStart: boolean;
  earlyReason: string | null;
  createdAt: string;
};

export type ShiftReflection = {
  id: string;
  dateKey: string;
  employeeId: string;
  mood: ShiftMood;
  starRecipientId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpecialStarAward = {
  id: string;
  dateKey: string;
  employeeId: string;
  issuedByEmployeeId: string;
  createdAt: string;
};

export type RevenueGoals = {
  weeklyRevenueTarget: number | null;
  monthlyRevenueTarget: number | null;
  monthlyAverageCheckStart: number | null;
  monthlyAverageCheckTarget: number | null;
};

export type DailyBusinessMetric = {
  dateKey: string;
  revenueActual: number | null;
  averageCheckTarget: number | null;
  averageCheckActual: number | null;
  updatedAt: string;
};

export type AppState = {
  telegramName: string;
  shift: Shift;
  tasks: Task[];
  losses: Losses;
  handoffItems: HandoffItem[];
  requests: Request[];
  employees: Employee[];
  loginEmployees: EmployeeLoginOption[];
  session: SessionState;
  timeEntries: TimeEntry[];
  shiftReflections: ShiftReflection[];
  specialStarAwards: SpecialStarAward[];
  revenueGoals: RevenueGoals;
  dailyBusinessMetrics: DailyBusinessMetric[];
};
