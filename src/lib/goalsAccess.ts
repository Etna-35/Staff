import type { EmployeeRole } from '../types/domain';

export const canAccessGoals = (role: EmployeeRole | null | undefined) =>
  role === 'owner' || role === 'bartender';
