import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  getBuiltInTemplates,
  getTemplateById,
  createTemplateFromStyle,
  duplicateTemplate,
  exportTemplateAsJson,
  validateTemplateJson,
} from '../src/shared/templates';
import {
  FONT_CATALOG,
  validateFontFile,
  type FontCategory,
  type FontDefinition,
} from '../src/shared/fonts';
import { CaptionTemplateSchema, CaptionStyleSchema } from '../src/shared/schemas';
import { useAppStore } from '../src/renderer/src/store/useAppStore';
import type { CaptionStyle, CaptionTemplate } from '../src/shared/types';

describe('Cinematic Typography & Preset Templates System', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      customTemplates: [],
      userFonts: [],
      currentProject: {
        id: 'test-proj',
        name: 'Test Typography Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mediaAsset: null,
        captionSegments: [
          {
            id: 'seg-1',
            text: 'CINEMATIC MASTERPIECE IN HINDI एंड ENGLISH',
            startMs: 0,
            endMs: 3000,
            words: [
              { id: 'w-1', text: 'CINEMATIC', startMs: 0, endMs: 700 },
              { id: 'w-2', text: 'MASTERPIECE', startMs: 750, endMs: 1500 },
              { id: 'w-3', text: 'IN', startMs: 1550, endMs: 1800 },
              { id: 'w-4', text: 'HINDI', startMs: 1850, endMs: 2300 },
              { id: 'w-5', text: 'एंड', startMs: 2350, endMs: 2600 },
              { id: 'w-6', text: 'ENGLISH', startMs: 2650, endMs: 3000 },
            ],
          },
        ],
        captionStyle: { ...BUILTIN_TEMPLATES[0]!.style },
        aspectRatio: '9:16',
      },
    });
  });

  describe('12 Original Built-in Presets Collection', () => {
    it('provides the built-in preset collection with all original presets and unique IDs', () => {
      const templates = getBuiltInTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(12);

      const ids = templates.map((t) => t.id);
      expect(new Set(ids).size).toBe(templates.length); // All IDs must be unique
    });

    it('contains all required original presets with distinct identities', () => {
      const expectedPresets = [
        'cinematic-trailer',
        'minimal-cinema',
        'luxury-editorial',
        'documentary',
        'kinetic-bold',
        'modern-creator',
        'retro-film',
        'clean-subtitles',
        'news-editorial',
        'hindi-friendly',
        'podcast-captions',
        'dramatic-emphasis',
      ];

      const templates = getBuiltInTemplates();
      const ids = templates.map((t) => t.id);

      expectedPresets.forEach((presetId) => {
        expect(ids).toContain(presetId);
        const tpl = templates.find((t) => t.id === presetId);
        expect(tpl).toBeDefined();
        expect(tpl?.isBuiltIn).toBe(true);
        expect(tpl?.schemaVersion).toBe('1.0.0');
        expect(tpl?.name).toBeTruthy();
        expect(tpl?.description).toBeTruthy();
      });
    });

    it('validates that every built-in template strictly conforms to CaptionTemplateSchema', () => {
      BUILTIN_TEMPLATES.forEach((template) => {
        const result = CaptionTemplateSchema.safeParse(template);
        expect(
          result.success,
          `Template ${template.id} failed schema validation: ${
            result.success ? '' : JSON.stringify(result.error.issues)
          }`
        ).toBe(true);
      });
    });

    it('ensures each preset defines complete typography, positioning, border and box properties', () => {
      BUILTIN_TEMPLATES.forEach((tpl) => {
        const { style } = tpl;
        expect(style.fontFamily).toBeTruthy();
        expect(style.fontSize).toBeGreaterThanOrEqual(18);
        expect(style.fontSize).toBeLessThanOrEqual(80);
        expect(style.fontWeight).toBeGreaterThanOrEqual(300);
        expect(style.fontWeight).toBeLessThanOrEqual(900);
        expect(style.textColor).toMatch(/^#[0-9A-Fa-f]{6}$|^rgba?\(/);
        expect(style.strokeWidth).toBeGreaterThanOrEqual(0);
        expect(style.positionYPercent).toBeGreaterThanOrEqual(5);
        expect(style.positionYPercent).toBeLessThanOrEqual(85);
        expect(style.positionXPercent).toBeGreaterThanOrEqual(10);
        expect(style.positionXPercent).toBeLessThanOrEqual(90);
        expect(style.maxWidthPercent).toBeGreaterThanOrEqual(40);
        expect(style.maxWidthPercent).toBeLessThanOrEqual(100);
        expect(style.lineHeight).toBeGreaterThanOrEqual(1.0);
        expect(style.activeWordColor).toBeTruthy();
      });
    });

    it('validates Hindi-friendly preset uses proper Devanagari typography and generous line height', () => {
      const hindiTpl = BUILTIN_TEMPLATES.find((t) => t.id === 'hindi-friendly');
      expect(hindiTpl).toBeDefined();
      expect(hindiTpl?.category).toBe('multilingual');
      // Hindi matras (accents above and below) require at least 1.35x line height to prevent clipping
      expect(hindiTpl?.style.lineHeight).toBeGreaterThanOrEqual(1.35);
      expect(hindiTpl?.style.fontFamily).toContain('Noto Sans Devanagari');
    });
  });

  describe('Template Creator, Duplication & Management', () => {
    it('creates a custom template from active style with unique ID and version 1.0.0', () => {
      const currentStyle = useAppStore.getState().currentProject.captionStyle;
      const custom = createTemplateFromStyle(
        'My Brand Signature',
        currentStyle,
        'creator',
        'Vibrant high-contrast captions for YouTube Shorts'
      );

      expect(custom.schemaVersion).toBe('1.0.0');
      expect(custom.id).toMatch(/^tpl_\d+_/);
      expect(custom.name).toBe('My Brand Signature');
      expect(custom.category).toBe('creator');
      expect(custom.description).toBe('Vibrant high-contrast captions for YouTube Shorts');
      expect(custom.isBuiltIn).toBe(false);
      expect(custom.style.templateName).toBe('My Brand Signature');

      const parseResult = CaptionTemplateSchema.safeParse(custom);
      expect(parseResult.success).toBe(true);
    });

    it('duplicates an existing template and appends (Copy) moniker', () => {
      const source = BUILTIN_TEMPLATES.find((t) => t.id === 'cinematic-trailer')!;
      const duplicated = duplicateTemplate(source);

      expect(duplicated.name).toBe('Cinematic Trailer (Copy)');
      expect(duplicated.id).not.toBe(source.id);
      expect(duplicated.isBuiltIn).toBe(false);
      expect(duplicated.style.fontFamily).toBe(source.style.fontFamily);
      expect(duplicated.style.activeWordColor).toBe(source.style.activeWordColor);
    });

    it('supports saving, duplicating, and deleting custom templates via store actions', () => {
      const store = useAppStore.getState();

      // 1. Save new template
      const saved = store.saveCustomTemplate('Viral Pop Custom', 'creator', 'Signature style');
      expect(useAppStore.getState().customTemplates).toHaveLength(1);
      expect(useAppStore.getState().customTemplates[0]?.name).toBe('Viral Pop Custom');

      // 2. Duplicate it
      const dup = store.duplicateTemplateAction(saved.id, 'Viral Pop Custom V2');
      expect(dup).toBeDefined();
      expect(useAppStore.getState().customTemplates).toHaveLength(2);
      expect(useAppStore.getState().customTemplates[0]?.name).toBe('Viral Pop Custom V2');

      // 3. Delete the original
      store.deleteCustomTemplate(saved.id);
      expect(useAppStore.getState().customTemplates).toHaveLength(1);
      expect(useAppStore.getState().customTemplates[0]?.id).toBe(dup?.id);
    });
  });

  describe('Template JSON Export, Import & Schema Validation', () => {
    it('serializes template to formatted JSON and deserializes with validation', () => {
      const original = BUILTIN_TEMPLATES[0]!;
      const jsonStr = exportTemplateAsJson(original);

      expect(typeof jsonStr).toBe('string');
      expect(jsonStr).toContain('"schemaVersion": "1.0.0"');

      const validation = validateTemplateJson(jsonStr);
      expect(validation.success).toBe(true);
      expect(validation.template).toBeDefined();
      expect(validation.template?.id).toBe(original.id);
      expect(validation.template?.name).toBe(original.name);
    });

    it('rejects malformed JSON syntax gracefully', () => {
      const malformedJson = '{ "name": "Broken Template", "style": ';
      const result = validateTemplateJson(malformedJson);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('rejects JSON template with invalid schema structure or missing critical fields', () => {
      const invalidTemplate = JSON.stringify({
        schemaVersion: '1.0.0',
        id: 'bad-tpl',
        // missing name, category, and style
      });

      const result = validateTemplateJson(invalidTemplate);
      expect(result.success).toBe(false);
      expect(result.error).toContain('name');
    });

    it('imports valid JSON template into store and assigns safe unique ID', () => {
      const validTpl = createTemplateFromStyle('Imported Gold', BUILTIN_TEMPLATES[1]!.style);
      const jsonStr = exportTemplateAsJson(validTpl);

      const store = useAppStore.getState();
      const importResult = store.importTemplateFromJson(jsonStr);

      expect(importResult.success).toBe(true);
      expect(importResult.template).toBeDefined();
      expect(importResult.template?.isBuiltIn).toBe(false);
      expect(importResult.template?.name).toBe('Imported Gold');

      // Check it was added to custom templates
      const templates = useAppStore.getState().customTemplates;
      expect(templates.some((t) => t.name === 'Imported Gold')).toBe(true);

      // Check it auto-applied to active project style
      expect(useAppStore.getState().currentProject.captionStyle.templateName).toBe('Imported Gold');
    });
  });

  describe('Font Catalog, Licensing & Hindi Multilingual Coverage', () => {
    it('includes all 9 required categories in the font catalog', () => {
      const requiredCategories: FontCategory[] = [
        'condensed',
        'bold',
        'sans-serif',
        'serif',
        'editorial',
        'rounded',
        'display',
        'monospace',
        'hindi',
      ];

      const presentCategories = new Set(FONT_CATALOG.map((f) => f.category));
      requiredCategories.forEach((cat) => {
        expect(presentCategories.has(cat), `Missing required font category: ${cat}`).toBe(true);
      });
    });

    it('strictly tracks permissive license (OFL 1.1 or Apache 2.0) and source for every bundled font', () => {
      FONT_CATALOG.forEach((font) => {
        expect(font.family).toBeTruthy();
        expect(font.source).toBeTruthy();
        expect(['SIL OFL 1.1', 'Apache 2.0', 'User Verified']).toContain(font.licenseType);
        expect(font.license).toBeTruthy();
        expect(font.weights.length).toBeGreaterThan(0);
        expect(font.sampleText).toBeTruthy();
      });
    });

    it('provides comprehensive Hindi and Devanagari script coverage', () => {
      const hindiFonts = FONT_CATALOG.filter((f) => f.supportsHindi);
      expect(hindiFonts.length).toBeGreaterThanOrEqual(4);

      const hindiFamilies = hindiFonts.map((f) => f.family);
      expect(hindiFamilies).toContain('Noto Sans Devanagari');
      expect(hindiFamilies).toContain('Poppins');
      expect(hindiFamilies).toContain('Rozha One');
      expect(hindiFamilies).toContain('Mukta');

      // Verify Hindi sample text contains actual Devanagari glyphs
      hindiFonts.forEach((font) => {
        const hasDevanagariUnicode = /[\u0900-\u097F]/.test(font.sampleText);
        expect(hasDevanagariUnicode, `Font ${font.family} sample should contain Devanagari glyphs`).toBe(true);
      });
    });
  });

  describe('Font File Security & Container Verification', () => {
    // Helper to generate mock font buffers with specific magic bytes
    function createMockFontFile(name: string, size: number, magicBytes: number[]): {
      name: string;
      size: number;
      arrayBuffer: () => Promise<ArrayBuffer>;
    } {
      const buffer = new ArrayBuffer(magicBytes.length);
      const view = new DataView(buffer);
      magicBytes.forEach((b, i) => view.setUint8(i, b));
      return {
        name,
        size,
        arrayBuffer: async () => buffer,
      };
    }

    it('accepts valid TrueType (.ttf) font container (0x00010000)', async () => {
      const file = createMockFontFile('custom_font.ttf', 1024, [0x00, 0x01, 0x00, 0x00]);
      const res = await validateFontFile(file);
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('ttf');
    });

    it('accepts valid OpenType (.otf) font container (OTTO)', async () => {
      // 'OTTO' = [0x4F, 0x54, 0x54, 0x4F]
      const file = createMockFontFile('designer_font.otf', 2048, [0x4f, 0x54, 0x54, 0x4f]);
      const res = await validateFontFile(file);
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('otf');
    });

    it('accepts valid WOFF (.woff) container (wOFF)', async () => {
      // 'wOFF' = [0x77, 0x4F, 0x46, 0x46]
      const file = createMockFontFile('web_font.woff', 1024, [0x77, 0x4f, 0x46, 0x46]);
      const res = await validateFontFile(file);
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('woff');
    });

    it('accepts valid WOFF2 (.woff2) container (wOF2)', async () => {
      // 'wOF2' = [0x77, 0x4F, 0x46, 0x32]
      const file = createMockFontFile('modern_web.woff2', 1024, [0x77, 0x4f, 0x46, 0x32]);
      const res = await validateFontFile(file);
      expect(res.isValid).toBe(true);
      expect(res.format).toBe('woff2');
    });

    it('rejects font file exceeding 15MB maximum size limit', async () => {
      const largeSize = 16 * 1024 * 1024; // 16MB
      const file = createMockFontFile('huge_font.ttf', largeSize, [0x00, 0x01, 0x00, 0x00]);
      const res = await validateFontFile(file);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('15MB maximum size limit');
    });

    it('rejects invalid file extensions even if disguised', async () => {
      const exeFile = createMockFontFile('malicious.exe', 1024, [0x4d, 0x5a, 0x90, 0x00]);
      const res = await validateFontFile(exeFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid font extension');
    });

    it('rejects corrupted or malicious files with mismatched header magic bytes', async () => {
      // Named .ttf but has random or executable bytes (MZ Windows Executable header)
      const fakeFont = createMockFontFile('exploit.ttf', 1024, [0x4d, 0x5a, 0x00, 0x00]);
      const res = await validateFontFile(fakeFont);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('header magic bytes mismatch');
    });
  });

  describe('State Synchronization & Live Video Preview Guarantees', () => {
    it('applies template style immediately to project without mutating transcript segments', () => {
      const store = useAppStore.getState();
      const initialSegments = [...store.currentProject.captionSegments];

      const luxuryTemplate = BUILTIN_TEMPLATES.find((t) => t.id === 'luxury-editorial')!;
      store.applyTemplate(luxuryTemplate);

      const updatedProject = useAppStore.getState().currentProject;
      expect(updatedProject.captionStyle.fontFamily).toBe(luxuryTemplate.style.fontFamily);
      expect(updatedProject.captionStyle.textColor).toBe(luxuryTemplate.style.textColor);
      expect(updatedProject.captionStyle.positionYPercent).toBe(luxuryTemplate.style.positionYPercent);

      // Verify transcript data integrity is preserved 100%
      expect(updatedProject.captionSegments).toEqual(initialSegments);
      expect(updatedProject.captionSegments[0]?.text).toBe('CINEMATIC MASTERPIECE IN HINDI एंड ENGLISH');
    });

    it('updates individual typography controls reactively', () => {
      const store = useAppStore.getState();

      store.updateStyle({
        fontSize: 54,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 4.5,
        lineHeight: 1.4,
        textAlign: 'right',
        maxWidthPercent: 75,
        strokeWidth: 4,
        hasShadow: true,
        shadowBlur: 10,
        positionYPercent: 22,
        positionXPercent: 55,
      });

      const updatedStyle = useAppStore.getState().currentProject.captionStyle;
      expect(updatedStyle.fontSize).toBe(54);
      expect(updatedStyle.fontWeight).toBe(800);
      expect(updatedStyle.textTransform).toBe('uppercase');
      expect(updatedStyle.letterSpacing).toBe(4.5);
      expect(updatedStyle.lineHeight).toBe(1.4);
      expect(updatedStyle.textAlign).toBe('right');
      expect(updatedStyle.maxWidthPercent).toBe(75);
      expect(updatedStyle.strokeWidth).toBe(4);
      expect(updatedStyle.hasShadow).toBe(true);
      expect(updatedStyle.shadowBlur).toBe(10);
      expect(updatedStyle.positionYPercent).toBe(22);
      expect(updatedStyle.positionXPercent).toBe(55);
    });
  });
});
