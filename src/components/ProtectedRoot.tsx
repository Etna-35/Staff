import { useEffect } from 'react';
import { AppShell } from './AppShell';
import { PinAuthScreen } from '../screens/PinAuthScreen';
import { initTelegramApp } from '../lib/telegram';
import { useAppStore } from '../store/useAppStore';

export const ProtectedRoot = () => {
  const session = useAppStore((state) => state.session);
  const authError = useAppStore((state) => state.authError);
  const loadBootstrapStatus = useAppStore((state) => state.loadBootstrapStatus);
  const loadMe = useAppStore((state) => state.loadMe);

  useEffect(() => {
    initTelegramApp();
  }, []);

  useEffect(() => {
    void loadBootstrapStatus();
  }, [loadBootstrapStatus]);

  useEffect(() => {
    if (session.bootstrapped && session.token) {
      void loadMe();
    }
  }, [loadMe, session.bootstrapped, session.token]);

  if (session.bootstrapped === null) {
    if (authError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
          <div className="w-full rounded-panel bg-white/90 p-6 shadow-card">
            <p className="text-sm text-ink/55">Restaurant OS</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
              Нет связи с доступом
            </h1>
            <p className="mt-3 text-sm text-red-700">{authError}</p>
            <button
              className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              onClick={() => void loadBootstrapStatus()}
            >
              Повторить
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-panel bg-white/90 p-6 text-center shadow-card">
          <p className="text-sm text-ink/55">Restaurant OS</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
            Подключаем доступ
          </h1>
          <p className="mt-3 text-sm text-ink/60">
            Проверяем общий доступ и текущую сессию.
          </p>
        </div>
      </div>
    );
  }

  if (!session.bootstrapped) {
    return <PinAuthScreen />;
  }

  if (!session.token) {
    return <PinAuthScreen />;
  }

  if (!session.me) {
    if (authError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
          <div className="w-full rounded-panel bg-white/90 p-6 shadow-card">
            <p className="text-sm text-ink/55">Restaurant OS</p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
              Не удалось открыть профиль
            </h1>
            <p className="mt-3 text-sm text-red-700">{authError}</p>
            <button
              className="mt-4 w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              onClick={() => void loadMe()}
            >
              Повторить
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-panel bg-white/90 p-6 text-center shadow-card">
          <p className="text-sm text-ink/55">Restaurant OS</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
            Открываем смену
          </h1>
          <p className="mt-3 text-sm text-ink/60">Проверяем профиль сотрудника.</p>
        </div>
      </div>
    );
  }

  return <AppShell />;
};
