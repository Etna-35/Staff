import type { Employee } from '../types/domain';

export const canAccessGoals = (employee: Pick<Employee, 'role' | 'department' | 'positionTitle'> | null | undefined) => {
  if (!employee) {
    return false;
  }

  if (employee.role === 'owner' || employee.role === 'bartender') {
    return true;
  }

  if (employee.department === 'bar') {
    return true;
  }

  return employee.positionTitle.trim().toLocaleLowerCase('ru-RU').includes('бар');
};
