import { Navigate } from 'react-router-dom';
import { canAccessGoals } from '../lib/goalsAccess';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';
import { GoalsScreen } from '../screens/GoalsScreen';

export const OwnerGoalsRoute = () => {
  const currentEmployee = useAppStore(getCurrentEmployee);

  if (!canAccessGoals(currentEmployee)) {
    return <Navigate to="/" replace />;
  }

  return <GoalsScreen />;
};
