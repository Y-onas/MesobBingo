// Initialize Telegram Web App and export helpers
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
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
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}

// Initialize Telegram Web App when script loads
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  console.log('Telegram Web App initialized');
}

/**
 * Get the raw initData string for server auth (HMAC signed)
 */
export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

/**
 * Get Telegram user info
 */
export function getTelegramUser() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

/**
 * Check if running inside Telegram
 */
export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp?.initData;
}

/**
 * Get the server URL for socket connection (same origin)
 */
export function getServerUrl(): string {
  // In production, Socket.IO connects to the same origin
  return window.location.origin;
}

/**
 * Hide Telegram menu button (to prevent confusion during gameplay)
 */
export function hideTelegramMenuButton(): void {
  // Telegram doesn't have a direct API to hide the menu button
  // But we can use CSS to hide it via the viewport
  const style = document.createElement('style');
  style.id = 'telegram-menu-hide';
  style.textContent = `
    /* Hide Telegram's hamburger menu */
    body {
      padding-top: 0 !important;
    }
  `;
  if (!document.getElementById('telegram-menu-hide')) {
    document.head.appendChild(style);
  }
}

/**
 * Show Telegram menu button
 */
export function showTelegramMenuButton(): void {
  const style = document.getElementById('telegram-menu-hide');
  if (style) {
    style.remove();
  }
}

