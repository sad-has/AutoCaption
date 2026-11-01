export type FontCategory =
  | 'condensed'
  | 'bold'
  | 'sans-serif'
  | 'serif'
  | 'editorial'
  | 'rounded'
  | 'display'
  | 'monospace'
  | 'hindi';

export interface FontDefinition {
  family: string;
  displayName: string;
  category: FontCategory;
  categoryLabel: string;
  source: 'Google Fonts' | 'System' | 'User Upload';
  license: string;
  licenseType: 'SIL OFL 1.1' | 'Apache 2.0' | 'User Verified';
  weights: number[];
  supportsHindi: boolean;
  sampleText: string;
  googleFontsFamily?: string; // Query string for Google Fonts API
}

/**
 * Curated, Permissively Licensed Typography Registry.
 * Every font is licensed under SIL Open Font License (OFL) or Apache 2.0.
 */
export const FONT_CATALOG: FontDefinition[] = [
  // 1. Condensed
  {
    family: 'Anton',
    displayName: 'Anton',
    category: 'condensed',
    categoryLabel: 'Heavy Condensed',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: false,
    sampleText: 'VIRAL IMPACT',
    googleFontsFamily: 'Anton',
  },
  {
    family: 'Oswald',
    displayName: 'Oswald',
    category: 'condensed',
    categoryLabel: 'Condensed Sans',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400, 600, 700],
    supportsHindi: false,
    sampleText: 'RETRO HEADLINE',
    googleFontsFamily: 'Oswald:wght@400;600;700',
  },
  {
    family: 'Bebas Neue',
    displayName: 'Bebas Neue',
    category: 'condensed',
    categoryLabel: 'Tall Condensed',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: false,
    sampleText: 'CINEMATIC VERTICAL',
    googleFontsFamily: 'Bebas+Neue',
  },

  // 2. Bold & Punchy
  {
    family: 'Montserrat',
    displayName: 'Montserrat',
    category: 'bold',
    categoryLabel: 'Punchy Modern',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400, 600, 700, 800, 900],
    supportsHindi: false,
    sampleText: 'CREATOR EMPIRE',
    googleFontsFamily: 'Montserrat:wght@400;600;700;800;900',
  },
  {
    family: 'Syne',
    displayName: 'Syne',
    category: 'bold',
    categoryLabel: 'Dramatic Display',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [700, 800],
    supportsHindi: false,
    sampleText: 'DRAMATIC EMPHASIS',
    googleFontsFamily: 'Syne:wght@700;800',
  },
  {
    family: 'Archivo Black',
    displayName: 'Archivo Black',
    category: 'bold',
    categoryLabel: 'Ultra Heavy',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: false,
    sampleText: 'TITANIC POWER',
    googleFontsFamily: 'Archivo+Black',
  },

  // 3. Sans-Serif
  {
    family: 'Inter',
    displayName: 'Inter',
    category: 'sans-serif',
    categoryLabel: 'Neutral Precision',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400, 500, 600, 700],
    supportsHindi: false,
    sampleText: 'Minimal cinema precision',
    googleFontsFamily: 'Inter:wght@400;500;600;700',
  },
  {
    family: 'Roboto',
    displayName: 'Roboto',
    category: 'sans-serif',
    categoryLabel: 'Universal Modern',
    source: 'Google Fonts',
    license: 'Apache License 2.0',
    licenseType: 'Apache 2.0',
    weights: [400, 500, 700],
    supportsHindi: false,
    sampleText: 'Documentary broadcast subtitle',
    googleFontsFamily: 'Roboto:wght@400;500;700',
  },
  {
    family: 'Plus Jakarta Sans',
    displayName: 'Plus Jakarta Sans',
    category: 'sans-serif',
    categoryLabel: 'Geometric Sans',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [500, 600, 700],
    supportsHindi: false,
    sampleText: 'Clean modern dialogue',
    googleFontsFamily: 'Plus+Jakarta+Sans:wght@500;600;700',
  },

  // 4. Serif
  {
    family: 'Cinzel',
    displayName: 'Cinzel',
    category: 'serif',
    categoryLabel: 'Cinematic Roman',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [600, 700, 800],
    supportsHindi: false,
    sampleText: 'CHRONICLES OF TIME',
    googleFontsFamily: 'Cinzel:wght@600;700;800',
  },
  {
    family: 'Playfair Display',
    displayName: 'Playfair Display',
    category: 'serif',
    categoryLabel: 'Luxury Editorial',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [600, 700, 800],
    supportsHindi: false,
    sampleText: 'Timeless Elegance',
    googleFontsFamily: 'Playfair+Display:ital,wght@0,600;0,700;0,800',
  },
  {
    family: 'Lora',
    displayName: 'Lora',
    category: 'serif',
    categoryLabel: 'Literary Contemporary',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [500, 600, 700],
    supportsHindi: false,
    sampleText: 'Narrative storytelling',
    googleFontsFamily: 'Lora:wght@500;600;700',
  },

  // 5. Editorial
  {
    family: 'Space Grotesk',
    displayName: 'Space Grotesk',
    category: 'editorial',
    categoryLabel: 'Brutalist News',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [500, 600, 700],
    supportsHindi: false,
    sampleText: 'INVESTIGATIVE JOURNALISM',
    googleFontsFamily: 'Space+Grotesk:wght@500;600;700',
  },
  {
    family: 'Cormorant Garamond',
    displayName: 'Cormorant Garamond',
    category: 'editorial',
    categoryLabel: 'Fine Press Serif',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [600, 700],
    supportsHindi: false,
    sampleText: 'Poetic Reflections',
    googleFontsFamily: 'Cormorant+Garamond:wght@600;700',
  },

  // 6. Rounded
  {
    family: 'Nunito',
    displayName: 'Nunito',
    category: 'rounded',
    categoryLabel: 'Friendly Rounded',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [600, 700, 800],
    supportsHindi: false,
    sampleText: 'Approachable and warm',
    googleFontsFamily: 'Nunito:wght@600;700;800',
  },
  {
    family: 'Quicksand',
    displayName: 'Quicksand',
    category: 'rounded',
    categoryLabel: 'Modern Rounded',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [600, 700],
    supportsHindi: false,
    sampleText: 'Soft geometric curves',
    googleFontsFamily: 'Quicksand:wght@600;700',
  },

  // 7. Display
  {
    family: 'Righteous',
    displayName: 'Righteous',
    category: 'display',
    categoryLabel: 'Retro Arcade',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: false,
    sampleText: 'SYNTHWAVE DREAMS',
    googleFontsFamily: 'Righteous',
  },
  {
    family: 'Bungee',
    displayName: 'Bungee',
    category: 'display',
    categoryLabel: 'Urban Signage',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: false,
    sampleText: 'STREET STYLE',
    googleFontsFamily: 'Bungee',
  },

  // 8. Monospace
  {
    family: 'Fira Code',
    displayName: 'Fira Code',
    category: 'monospace',
    categoryLabel: 'Code Terminal',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [500, 600, 700],
    supportsHindi: false,
    sampleText: 'const captions = true;',
    googleFontsFamily: 'Fira+Code:wght@500;600;700',
  },
  {
    family: 'JetBrains Mono',
    displayName: 'JetBrains Mono',
    category: 'monospace',
    categoryLabel: 'Technical Mono',
    source: 'Google Fonts',
    license: 'Apache License 2.0',
    licenseType: 'Apache 2.0',
    weights: [500, 700],
    supportsHindi: false,
    sampleText: 'TERMINAL PROTOCOL',
    googleFontsFamily: 'JetBrains+Mono:wght@500;700',
  },

  // 9. Hindi & Multilingual (Devanagari glyph coverage)
  {
    family: 'Noto Sans Devanagari',
    displayName: 'Noto Sans Devanagari',
    category: 'hindi',
    categoryLabel: 'Authentic Hindi',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400, 600, 700, 800],
    supportsHindi: true,
    sampleText: 'सिनेमैटिक कैप्शन • Namaste India',
    googleFontsFamily: 'Noto+Sans+Devanagari:wght@400;600;700;800',
  },
  {
    family: 'Poppins',
    displayName: 'Poppins',
    category: 'hindi',
    categoryLabel: 'Modern Hinglish',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400, 600, 700, 800],
    supportsHindi: true,
    sampleText: 'कंटेंट क्रिएटर • Viral Reels',
    googleFontsFamily: 'Poppins:wght@400;600;700;800',
  },
  {
    family: 'Rozha One',
    displayName: 'Rozha One',
    category: 'hindi',
    categoryLabel: 'Devanagari Headline',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [400],
    supportsHindi: true,
    sampleText: 'शाही अंदाज • Grand Hindi',
    googleFontsFamily: 'Rozha+One',
  },
  {
    family: 'Mukta',
    displayName: 'Mukta',
    category: 'hindi',
    categoryLabel: 'Contemporary Hindi',
    source: 'Google Fonts',
    license: 'SIL Open Font License 1.1',
    licenseType: 'SIL OFL 1.1',
    weights: [500, 600, 700, 800],
    supportsHindi: true,
    sampleText: 'विश्वसनीय उपशीर्षक • Clean Hindi',
    googleFontsFamily: 'Mukta:wght@500;600;700;800',
  },
];

export const FONT_CATEGORIES: { id: FontCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Fonts' },
  { id: 'hindi', label: 'Hindi & Multilingual' },
  { id: 'bold', label: 'Bold & Punchy' },
  { id: 'condensed', label: 'Condensed' },
  { id: 'sans-serif', label: 'Sans-Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'display', label: 'Display' },
  { id: 'monospace', label: 'Monospace' },
];

/**
 * Dynamically loads a Google Font by injecting a stylesheet link into document.head.
 */
export function loadGoogleFont(font: FontDefinition): void {
  if (typeof document === 'undefined') return;
  if (!font.googleFontsFamily) return;

  const fontId = `gf-${font.family.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (document.getElementById(fontId)) return;

  const link = document.createElement('link');
  link.id = fontId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontsFamily}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Validates uploaded font file format and magic bytes to prevent arbitrary code execution.
 * Checks for valid TTF, OTF, WOFF, and WOFF2 container signatures.
 */
export async function validateFontFile(
  file: File | { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }
): Promise<{ isValid: boolean; error?: string; format?: 'ttf' | 'otf' | 'woff' | 'woff2' }> {
  const MAX_FONT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB limit

  if (file.size > MAX_FONT_SIZE_BYTES) {
    return { isValid: false, error: 'Font file exceeds 15MB maximum size limit.' };
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  const validExtensions = ['ttf', 'otf', 'woff', 'woff2'];
  if (!ext || !validExtensions.includes(ext)) {
    return { isValid: false, error: 'Invalid font extension. Supported formats: .ttf, .otf, .woff, .woff2' };
  }

  try {
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength < 4) {
      return { isValid: false, error: 'Font file is too small or corrupted.' };
    }

    const view = new DataView(buffer);
    const magic = view.getUint32(0, false);

    // TrueType: 0x00010000 or 'true' (0x74727565)
    if (magic === 0x00010000 || magic === 0x74727565) {
      return { isValid: true, format: 'ttf' };
    }

    // OpenType: 'OTTO' (0x4F54544F)
    if (magic === 0x4f54544f) {
      return { isValid: true, format: 'otf' };
    }

    // WOFF: 'wOFF' (0x774F4646)
    if (magic === 0x774f4646) {
      return { isValid: true, format: 'woff' };
    }

    // WOFF2: 'wOF2' (0x774F4632)
    if (magic === 0x774f4632) {
      return { isValid: true, format: 'woff2' };
    }

    return { isValid: false, error: 'Font header magic bytes mismatch. Corrupted or unsupported font file.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error reading font file buffer.';
    return { isValid: false, error: msg };
  }
}
