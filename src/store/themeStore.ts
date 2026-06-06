import { create } from 'zustand';

export interface Theme {
  id: string;
  name: string;
  swatch: string;
  glow: string;
  colors: {
    bg: string;
    surface: string;
    surfaceHover: string;
    border: string;
    borderFocus: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    dot: string;
    shadow: string;
    folderCover: string;
    folderBack: string;
    folderText: string;
    folderCount: string;
  };
}

// ─── THEMES ───────────────────────────────────────────────
// 19 themes, ordered for the circular picker layout.
// Existing themes keep their original order; the final four extend the outer ring.

export const themes: Theme[] = [
  // ── CENTER (1): Most neutral light ────────────────────
  {
    id: 'pearl',
    name: 'Pearl',
    swatch: '#f5efe5',
    glow: 'rgba(240,230,210,0.35)',
    colors: {
      bg: '#f6f2eb', surface: '#fffdf8', surfaceHover: '#f8f5ef',
      border: '#e8e2d6', borderFocus: '#cec4b4',
      text: '#282218', textMuted: '#908472',
      accent: '#b87830', accentHover: '#9c6428',
      dot: 'rgba(45,35,15,0.05)', shadow: 'rgba(30,20,0,0.05)',
      folderCover: '#dcd4c4', folderBack: '#cec6b4',
      folderText: 'rgba(45,35,15,0.65)', folderCount: 'rgba(45,35,15,0.32)',
    },
  },

  // ── INNER RING (6): Light tints ──────────────────────
  {
    id: 'snow',
    name: 'Snow',
    swatch: '#f0f2f6',
    glow: 'rgba(220,225,240,0.35)',
    colors: {
      bg: '#f4f5f8', surface: '#ffffff', surfaceHover: '#f7f7fa',
      border: '#e4e6ea', borderFocus: '#c8ccd4',
      text: '#1c1e24', textMuted: '#808690',
      accent: '#5c5ce6', accentHover: '#4a4acc',
      dot: 'rgba(20,25,40,0.05)', shadow: 'rgba(0,0,0,0.05)',
      folderCover: '#d8dce4', folderBack: '#ccd0d8',
      folderText: 'rgba(20,25,40,0.65)', folderCount: 'rgba(20,25,40,0.32)',
    },
  },
  {
    id: 'blue-mist',
    name: 'Blue Mist',
    swatch: '#dce4f2',
    glow: 'rgba(180,200,240,0.3)',
    colors: {
      bg: '#eef0f4', surface: '#ffffff', surfaceHover: '#f3f4f7',
      border: '#dce0e6', borderFocus: '#b8bec8',
      text: '#1a1d24', textMuted: '#7c8494',
      accent: '#5146e8', accentHover: '#4338ca',
      dot: 'rgba(20,30,50,0.07)', shadow: 'rgba(0,0,0,0.06)',
      folderCover: '#c3ccd5', folderBack: '#b4c0cd',
      folderText: 'rgba(20,30,50,0.7)', folderCount: 'rgba(20,30,50,0.35)',
    },
  },
  {
    id: 'cloud',
    name: 'Cloud',
    swatch: '#e0e8f0',
    glow: 'rgba(200,215,235,0.3)',
    colors: {
      bg: '#f0f3f7', surface: '#ffffff', surfaceHover: '#f5f7fa',
      border: '#dde2e8', borderFocus: '#bcc4d0',
      text: '#1e2128', textMuted: '#7a8290',
      accent: '#4878b8', accentHover: '#3868a4',
      dot: 'rgba(20,30,48,0.05)', shadow: 'rgba(0,0,0,0.05)',
      folderCover: '#c8d2dc', folderBack: '#bcc6d0',
      folderText: 'rgba(20,30,48,0.65)', folderCount: 'rgba(20,30,48,0.32)',
    },
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    swatch: '#f2c4d0',
    glow: 'rgba(240,160,190,0.28)',
    colors: {
      bg: '#f5eef0', surface: '#fffafb', surfaceHover: '#f7f1f3',
      border: '#e6d8dc', borderFocus: '#c8b0b8',
      text: '#2a1a20', textMuted: '#947c84',
      accent: '#c44870', accentHover: '#a83860',
      dot: 'rgba(50,15,30,0.06)', shadow: 'rgba(40,0,15,0.06)',
      folderCover: '#d5b8c2', folderBack: '#c8aab4',
      folderText: 'rgba(50,15,30,0.7)', folderCount: 'rgba(50,15,30,0.35)',
    },
  },
  {
    id: 'lilac',
    name: 'Lilac',
    swatch: '#d4c0e8',
    glow: 'rgba(190,160,230,0.28)',
    colors: {
      bg: '#f2eef6', surface: '#fdfaff', surfaceHover: '#f5f1f8',
      border: '#e0d6ea', borderFocus: '#c0b0d4',
      text: '#221a28', textMuted: '#8878a0',
      accent: '#8854c8', accentHover: '#7040b0',
      dot: 'rgba(35,20,55,0.06)', shadow: 'rgba(25,0,50,0.05)',
      folderCover: '#c8b8d8', folderBack: '#b8a8cc',
      folderText: 'rgba(35,20,55,0.68)', folderCount: 'rgba(35,20,55,0.34)',
    },
  },
  {
    id: 'honey',
    name: 'Honey',
    swatch: '#f2d8a0',
    glow: 'rgba(240,200,120,0.28)',
    colors: {
      bg: '#f8f3e8', surface: '#fffdf5', surfaceHover: '#f9f5ec',
      border: '#ebe0cc', borderFocus: '#d0c0a0',
      text: '#2c2414', textMuted: '#988c6c',
      accent: '#c89020', accentHover: '#a87818',
      dot: 'rgba(55,40,10,0.06)', shadow: 'rgba(40,30,0,0.05)',
      folderCover: '#ddd0b0', folderBack: '#d0c4a0',
      folderText: 'rgba(55,40,10,0.68)', folderCount: 'rgba(55,40,10,0.34)',
    },
  },

  // ── OUTER RING (8): Saturated + darks ────────────────
  {
    id: 'sage',
    name: 'Sage',
    swatch: '#b8d8b8',
    glow: 'rgba(140,210,140,0.25)',
    colors: {
      bg: '#edf2ed', surface: '#fafdf9', surfaceHover: '#f0f4ef',
      border: '#d4ddd4', borderFocus: '#b0bfb0',
      text: '#1a241a', textMuted: '#6c8470',
      accent: '#3a8848', accentHover: '#2d7038',
      dot: 'rgba(15,40,20,0.06)', shadow: 'rgba(0,25,5,0.06)',
      folderCover: '#b8ccb8', folderBack: '#a8bca8',
      folderText: 'rgba(15,40,20,0.7)', folderCount: 'rgba(15,40,20,0.35)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: '#6898d0',
    glow: 'rgba(80,140,220,0.25)',
    colors: {
      bg: '#eaf0f8', surface: '#f8fbff', surfaceHover: '#eef3fa',
      border: '#ccdaec', borderFocus: '#a0b8d8',
      text: '#141c28', textMuted: '#6880a0',
      accent: '#2870c8', accentHover: '#1c5cac',
      dot: 'rgba(10,25,55,0.07)', shadow: 'rgba(0,15,50,0.06)',
      folderCover: '#b0c4dc', folderBack: '#a0b4d0',
      folderText: 'rgba(10,25,55,0.7)', folderCount: 'rgba(10,25,55,0.35)',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    swatch: '#4aaa6a',
    glow: 'rgba(50,180,90,0.22)',
    colors: {
      bg: '#e8f2ec', surface: '#f5fbf7', surfaceHover: '#ecf4ef',
      border: '#c4d8cc', borderFocus: '#98bca8',
      text: '#122018', textMuted: '#588068',
      accent: '#1a8844', accentHover: '#107034',
      dot: 'rgba(8,40,20,0.07)', shadow: 'rgba(0,30,10,0.06)',
      folderCover: '#a0c4ac', folderBack: '#90b8a0',
      folderText: 'rgba(8,40,20,0.7)', folderCount: 'rgba(8,40,20,0.35)',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    swatch: '#28685c',
    glow: 'rgba(40,120,100,0.25)',
    colors: {
      bg: '#0f1923', surface: '#162230', surfaceHover: '#1c2a3a',
      border: '#243448', borderFocus: '#2e4460',
      text: '#d8e4f0', textMuted: '#6888a8',
      accent: '#48c8a0', accentHover: '#38b088',
      dot: 'rgba(72,200,160,0.05)', shadow: 'rgba(0,0,0,0.3)',
      folderCover: '#1e3040', folderBack: '#162838',
      folderText: 'rgba(180,220,210,0.7)', folderCount: 'rgba(180,220,210,0.35)',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    swatch: '#222222',
    glow: 'rgba(60,60,60,0.25)',
    colors: {
      bg: '#0e0e0e', surface: '#1a1a1a', surfaceHover: '#222222',
      border: '#2a2a2a', borderFocus: '#3a3a3a',
      text: '#e8e8e8', textMuted: '#888888',
      accent: '#ffffff', accentHover: '#d0d0d0',
      dot: 'rgba(255,255,255,0.04)', shadow: 'rgba(0,0,0,0.4)',
      folderCover: '#222222', folderBack: '#1a1a1a',
      folderText: 'rgba(255,255,255,0.6)', folderCount: 'rgba(255,255,255,0.3)',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: '#384870',
    glow: 'rgba(60,80,140,0.25)',
    colors: {
      bg: '#14181e', surface: '#1e2430', surfaceHover: '#262d3a',
      border: '#2e3648', borderFocus: '#3e4860',
      text: '#e0e4ec', textMuted: '#7c8494',
      accent: '#7b8aff', accentHover: '#6670e8',
      dot: 'rgba(140,160,220,0.06)', shadow: 'rgba(0,0,0,0.3)',
      folderCover: '#2a3244', folderBack: '#222a3a',
      folderText: 'rgba(200,210,230,0.7)', folderCount: 'rgba(200,210,230,0.35)',
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    swatch: '#5c3a6e',
    glow: 'rgba(100,55,120,0.25)',
    colors: {
      bg: '#18121e', surface: '#221a2c', surfaceHover: '#2a2036',
      border: '#342a42', borderFocus: '#443858',
      text: '#e4dce8', textMuted: '#9484a4',
      accent: '#b078e0', accentHover: '#9860c8',
      dot: 'rgba(176,120,224,0.05)', shadow: 'rgba(0,0,0,0.3)',
      folderCover: '#2e2240', folderBack: '#261a38',
      folderText: 'rgba(210,190,230,0.7)', folderCount: 'rgba(210,190,230,0.35)',
    },
  },
  {
    id: 'coral',
    name: 'Coral',
    swatch: '#f0907c',
    glow: 'rgba(240,120,100,0.25)',
    colors: {
      bg: '#faf0ec', surface: '#fff8f5', surfaceHover: '#f8f0ec',
      border: '#e8d4cc', borderFocus: '#d0b0a4',
      text: '#2c1810', textMuted: '#a08070',
      accent: '#e05838', accentHover: '#c04828',
      dot: 'rgba(60,20,10,0.06)', shadow: 'rgba(50,10,0,0.06)',
      folderCover: '#dcc0b4', folderBack: '#d0b4a4',
      folderText: 'rgba(60,20,10,0.7)', folderCount: 'rgba(60,20,10,0.35)',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    swatch: '#c65a3a',
    glow: 'rgba(210,90,50,0.24)',
    colors: {
      bg: '#24120e', surface: '#321a14', surfaceHover: '#3c211a',
      border: '#4a2a22', borderFocus: '#6a3a2e',
      text: '#f2ded5', textMuted: '#b58a7a',
      accent: '#ff8a58', accentHover: '#e87442',
      dot: 'rgba(255,138,88,0.05)', shadow: 'rgba(0,0,0,0.32)',
      folderCover: '#44231a', folderBack: '#351a14',
      folderText: 'rgba(242,222,213,0.68)', folderCount: 'rgba(242,222,213,0.34)',
    },
  },
  {
    id: 'moss',
    name: 'Moss',
    swatch: '#6f7f4f',
    glow: 'rgba(115,135,75,0.24)',
    colors: {
      bg: '#171b12', surface: '#202719', surfaceHover: '#283020',
      border: '#303a25', borderFocus: '#4b5c35',
      text: '#e2ead7', textMuted: '#93a582',
      accent: '#a7c06a', accentHover: '#91aa58',
      dot: 'rgba(167,192,106,0.05)', shadow: 'rgba(0,0,0,0.3)',
      folderCover: '#303a25', folderBack: '#26301d',
      folderText: 'rgba(226,234,215,0.68)', folderCount: 'rgba(226,234,215,0.34)',
    },
  },
  {
    id: 'berry',
    name: 'Berry',
    swatch: '#9f4268',
    glow: 'rgba(180,70,115,0.24)',
    colors: {
      bg: '#211018', surface: '#301824', surfaceHover: '#3a1f2c',
      border: '#48283a', borderFocus: '#663850',
      text: '#f0dbe5', textMuted: '#b88a9c',
      accent: '#e86fa0', accentHover: '#cc5a88',
      dot: 'rgba(232,111,160,0.05)', shadow: 'rgba(0,0,0,0.32)',
      folderCover: '#422438', folderBack: '#351b2c',
      folderText: 'rgba(240,219,229,0.68)', folderCount: 'rgba(240,219,229,0.34)',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    swatch: '#586274',
    glow: 'rgba(100,115,135,0.24)',
    colors: {
      bg: '#13171d', surface: '#1c222b', surfaceHover: '#242b36',
      border: '#303846', borderFocus: '#465468',
      text: '#e1e7ef', textMuted: '#8793a4',
      accent: '#9fb4d8', accentHover: '#879fc6',
      dot: 'rgba(159,180,216,0.05)', shadow: 'rgba(0,0,0,0.3)',
      folderCover: '#2b3442', folderBack: '#222b38',
      folderText: 'rgba(225,231,239,0.68)', folderCount: 'rgba(225,231,239,0.34)',
    },
  },
];

// ─── STORE ────────────────────────────────────────────────

interface ThemeState {
  activeThemeId: string;
  setTheme: (id: string) => void;
}

const STORAGE_KEY = 'brain-canvas-theme';

// Locked to noir (white on black). Theme picker UI is removed.
export const useThemeStore = create<ThemeState>((set) => ({
  activeThemeId: 'noir',
  setTheme: (id) => {
    set({ activeThemeId: id });
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  },
}));

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}
