export type Role = 'employee' | 'owner';

export type MissionStatus = 'assigned' | 'done' | 'accepted' | 'returned';

export type RequestCategory = 'kitchen' | 'bar' | 'supplies';

export type Criticality = 'high' | 'medium' | 'low';

export type HandoffArea = 'kitchen' | 'bar';

export type StageKey = 'leftovers' | 'losses' | 'handoff' | 'closingPhotos';

export type TeamDepartment = 'kitchen' | 'bar' | 'hall' | 'other';

export type StaffRolePreset = 'waiter' | 'bartender' | 'cook' | 'custom';

export type TimesheetPeriod = 'day' | 'week' | 'month';

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
  createdAt: string;
};

export type StaffProfile = {
  id: string;
  name: string;
  department: TeamDepartment;
  rolePreset: StaffRolePreset;
  tenureLabel?: string;
  hourlyRate: number | null;
};

export type TimeEntry = {
  id: string;
  userId: string;
  rolePreset: StaffRolePreset;
  startAt: string;
  endAt: string | null;
  earlyStart: boolean;
  earlyReason: string | null;
  createdAt: string;
};

export type AppState = {
  role: Role;
  telegramName: string;
  currentUserId: string;
  shift: Shift;
  tasks: Task[];
  losses: Losses;
  handoffItems: HandoffItem[];
  requests: Request[];
  staffProfiles: StaffProfile[];
  timeEntries: TimeEntry[];
};
