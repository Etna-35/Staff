import { Navigate } from 'react-router-dom';
import { getCurrentEmployee, useAppStore } from '../store/useAppStore';
import { GoalsScreen } from '../screens/GoalsScreen';

export const OwnerGoalsRoute = () => {
  const currentEmployee = useAppStore(getCurrentEmployee);

  if (currentEmployee?.role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  return <GoalsScreen />;
};
