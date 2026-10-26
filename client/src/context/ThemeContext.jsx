import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'sw_theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore localStorage errors
  }
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setResolvedTheme(stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    setStoredTheme(theme);
    const resolved = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    setResolvedTheme(resolved);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = mediaQuery.matches ? 'dark' : 'light';
        applyTheme('system');
        setResolvedTheme(resolved);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
  }, []);

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'system', resolvedTheme: 'light', setTheme: () => {} }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'system',
      resolvedTheme: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      setTheme: (newTheme) => {
        if (typeof document !== 'undefined') {
          if (newTheme === 'dark') document.documentElement.classList.add('dark');
          else if (newTheme === 'light') document.documentElement.classList.remove('dark');
        }
      },
    };
  }
  return context;
}