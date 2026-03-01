/// <reference types="vite/client" />

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
};

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}

