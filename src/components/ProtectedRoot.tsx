import { useEffect } from 'react';
import { AppShell } from './AppShell';
import { PinAuthScreen } from '../screens/PinAuthScreen';
import { useAppStore } from '../store/useAppStore';

export const ProtectedRoot = () => {
  const isAuthenticated = useAppStore((state) => state.session.isAuthenticated);
  const ensureBootstrapOwner = useAppStore((state) => state.ensureBootstrapOwner);
  const ensureSessionValidity = useAppStore((state) => state.ensureSessionValidity);

  useEffect(() => {
    ensureBootstrapOwner();
    ensureSessionValidity();
  }, [ensureBootstrapOwner, ensureSessionValidity]);

  if (!isAuthenticated) {
    return <PinAuthScreen />;
  }

  return <AppShell />;
};
