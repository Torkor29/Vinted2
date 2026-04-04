declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    auth_date: number;
    hash: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setText: (text: string) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string) => void;
}

export function getTelegram(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getTelegram()?.initData ?? '';
}

export function getColorScheme(): 'light' | 'dark' {
  return getTelegram()?.colorScheme ?? 'light';
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getTelegram()?.HapticFeedback.impactOccurred(type);
  } catch {
    // ignore if not available
  }
}

export function hapticNotification(type: 'success' | 'error' | 'warning'): void {
  try {
    getTelegram()?.HapticFeedback.notificationOccurred(type);
  } catch {
    // ignore
  }
}

export function showBackButton(onClick: () => void): void {
  const tg = getTelegram();
  if (tg) {
    tg.BackButton.onClick(onClick);
    tg.BackButton.show();
  }
}

export function hideBackButton(): void {
  const tg = getTelegram();
  if (tg) {
    tg.BackButton.hide();
  }
}

export function openLink(url: string): void {
  const tg = getTelegram();
  if (tg) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

export function sendData(action: string, payload: unknown): void {
  const tg = getTelegram();
  if (tg) {
    tg.sendData(JSON.stringify({ action, payload }));
  }
}
