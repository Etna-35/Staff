import { Outlet } from 'react-router-dom';
import { BottomBar, Screen } from './ui';

export const AppShell = () => (
  <>
    <Screen>
      <Outlet />
    </Screen>
    <BottomBar />
  </>
);

