// Банки (Точка, Т-Банк) запрещают открывать свои страницы входа внутри iframe.
// В предпросмотре сайт работает во фрейме: заранее (прямо по клику, иначе браузер
// заблокирует) открываем пустую вкладку и потом отправляем её на страницу банка.
const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export interface AuthWindow {
  go: (url: string) => boolean;
  close: () => void;
}

export const prepareAuthWindow = (): AuthWindow => {
  if (!inFrame()) {
    return {
      go: (url) => {
        window.location.href = url;
        return true;
      },
      close: () => undefined
    };
  }
  const tab = window.open('about:blank', '_blank');
  return {
    go: (url) => {
      if (!tab || tab.closed) return false;
      tab.location.href = url;
      return true;
    },
    close: () => tab?.close()
  };
};
