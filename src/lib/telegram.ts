export const getTelegramWebApp = () => window.Telegram?.WebApp;

export const getTelegramDisplayName = () => {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;

  if (!user) {
    return 'Гость смены';
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  return fullName || user.username || 'Гость смены';
};

export const initTelegramApp = () => {
  const tg = getTelegramWebApp();

  if (!tg) {
    return;
  }

  tg.ready();
  tg.expand();
};

