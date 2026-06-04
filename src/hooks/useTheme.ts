import { useEffect, useRef } from 'react';
import { useThemeStore, getTheme } from '../store/themeStore';

function isDarkHexColor(hex: string) {
  const match = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return false;

  const [, r, g, b] = match;
  const luminance = (0.2126 * parseInt(r, 16) + 0.7152 * parseInt(g, 16) + 0.0722 * parseInt(b, 16)) / 255;
  return luminance < 0.36;
}

/**
 * Applies the active theme's CSS variables to :root.
 * Call once at the app root.
 */
export function useTheme() {
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const theme = getTheme(activeThemeId);
    const root = document.documentElement;
    const { colors } = theme;

    // Smooth transition for theme changes (skip first render)
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!isFirstRender.current) {
      root.classList.add('theme-transitioning');
      timer = setTimeout(() => root.classList.remove('theme-transitioning'), 320);
    }
    isFirstRender.current = false;

    root.style.setProperty('--color-bg', colors.bg);
    root.style.setProperty('--color-surface', colors.surface);
    root.style.setProperty('--color-surface-hover', colors.surfaceHover);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-border-focus', colors.borderFocus);
    root.style.setProperty('--color-text', colors.text);
    root.style.setProperty('--color-text-muted', colors.textMuted);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-accent-hover', colors.accentHover);
    root.style.setProperty('--color-dot', colors.dot);
    root.style.setProperty('--color-shadow', colors.shadow);
    root.style.setProperty('--color-folder-cover', colors.folderCover);
    root.style.setProperty('--color-folder-back', colors.folderBack);
    root.style.setProperty('--color-folder-text', colors.folderText);
    root.style.setProperty('--color-folder-count', colors.folderCount);
    root.style.setProperty('--shadow-card', `0 2px 8px ${colors.shadow}`);
    root.style.setProperty('--shadow-card-hover', `0 4px 16px ${colors.shadow}`);
    root.style.setProperty('--shadow-card-drag', `0 8px 32px ${colors.shadow}`);

    // Derive frosted glass color — light themes get white glass, dark get dark glass
    const isDark = isDarkHexColor(colors.bg);
    root.style.setProperty('--color-surface-glass',
      isDark ? 'rgba(30,30,30,0.55)' : 'rgba(255,255,255,0.55)'
    );
    root.style.setProperty('--color-glass-rim',
      isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
    );
    root.style.setProperty('--color-glass-rim-inset',
      isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
    );
    root.style.setProperty('--color-glass-rim-blend',
      isDark ? 'plus-lighter' : 'multiply'
    );

    return () => {
      if (timer != null) {
        clearTimeout(timer);
        root.classList.remove('theme-transitioning');
      }
    };
  }, [activeThemeId]);

  return activeThemeId;
}
