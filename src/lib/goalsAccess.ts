import type { Employee } from '../types/domain';

export const canAccessGoals = (
  employee: Pick<Employee, 'role' | 'department' | 'positionTitle'> | null | undefined,
) => Boolean(employee);
