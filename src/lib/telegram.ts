export const getTelegramWebApp = () => window.Telegram?.WebApp;

let isTelegramAppInitialized = false;
let isZoomLocked = false;

const lockViewportZoom = () => {
  if (isZoomLocked || typeof document === 'undefined') {
    return;
  }

  isZoomLocked = true;

  const preventDefault = (event: Event) => {
    event.preventDefault();
  };

  let lastTouchEnd = 0;

  document.addEventListener('gesturestart', preventDefault, { passive: false });
  document.addEventListener('gesturechange', preventDefault, { passive: false });
  document.addEventListener('gestureend', preventDefault, { passive: false });
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();

      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }

      lastTouchEnd = now;
    },
    { passive: false },
  );
};

export const getTelegramDisplayName = () => {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;

  if (!user) {
    return 'Гость смены';
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  return fullName || user.username || 'Гость смены';
};

export const initTelegramApp = () => {
  lockViewportZoom();

  if (isTelegramAppInitialized) {
    return;
  }

  isTelegramAppInitialized = true;

  const tg = getTelegramWebApp();

  if (!tg) {
    return;
  }

  tg.ready();
  tg.expand();
};
