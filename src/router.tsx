import { Navigate, createBrowserRouter } from 'react-router-dom';
import { ProtectedRoot } from './components/ProtectedRoot';
import { EmployeesScreen } from './screens/EmployeesScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { HandoffScreen } from './screens/HandoffScreen';
import { LossesScreen } from './screens/LossesScreen';
import { MissionsScreen } from './screens/MissionsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { ShiftScreen } from './screens/ShiftScreen';
import { TimesheetScreen } from './screens/TimesheetScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoot />,
    children: [
      {
        index: true,
        element: <ShiftScreen />,
      },
      {
        path: 'goals',
        element: <GoalsScreen />,
      },
      {
        path: 'missions',
        element: <MissionsScreen />,
      },
      {
        path: 'requests',
        element: <RequestsScreen />,
      },
      {
        path: 'profile',
        element: <ProfileScreen />,
      },
      {
        path: 'profile/timesheet',
        element: <TimesheetScreen />,
      },
      {
        path: 'profile/employees',
        element: <EmployeesScreen />,
      },
      {
        path: 'shift/handoff',
        element: <HandoffScreen />,
      },
      {
        path: 'shift/losses',
        element: <LossesScreen />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
