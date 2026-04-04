import { useEffect, useState } from 'react';
import { getTelegram, getColorScheme } from '../utils/telegram.js';

export function useTelegram() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(getColorScheme());

  useEffect(() => {
    const tg = getTelegram();
    if (tg) {
      tg.ready();
      tg.expand();
      setColorScheme(tg.colorScheme);
    }
  }, []);

  return { colorScheme };
}

export function useBackButton(onBack: () => void) {
  useEffect(() => {
    const tg = getTelegram();
    if (tg) {
      tg.BackButton.onClick(onBack);
      tg.BackButton.show();
      return () => {
        tg.BackButton.offClick(onBack);
        tg.BackButton.hide();
      };
    }
  }, [onBack]);
}

export function useMainButton(text: string, onClick: () => void, visible: boolean = true) {
  useEffect(() => {
    const tg = getTelegram();
    if (tg) {
      tg.MainButton.setText(text);
      tg.MainButton.onClick(onClick);
      if (visible) {
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
      return () => {
        tg.MainButton.offClick(onClick);
        tg.MainButton.hide();
      };
    }
  }, [text, onClick, visible]);
}
