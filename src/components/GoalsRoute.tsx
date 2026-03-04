import { Navigate } from 'react-router-dom';
import { canAccessGoals } from '../lib/goalsAccess';
import { GoalsScreen } from '../screens/GoalsScreen';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';

export const GoalsRoute = () => {
  const currentEmployee = useAppStore(getCurrentEmployee);

  if (!canAccessGoals(currentEmployee)) {
    return <Navigate to="/" replace />;
  }

  return <GoalsScreen />;
};
