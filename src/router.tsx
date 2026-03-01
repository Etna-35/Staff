import { createHashRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HandoffScreen } from './screens/HandoffScreen';
import { LossesScreen } from './screens/LossesScreen';
import { MissionsScreen } from './screens/MissionsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { ShiftScreen } from './screens/ShiftScreen';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <ShiftScreen />,
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
        path: 'shift/handoff',
        element: <HandoffScreen />,
      },
      {
        path: 'shift/losses',
        element: <LossesScreen />,
      },
    ],
  },
]);

