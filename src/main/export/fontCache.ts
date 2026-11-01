import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import https from 'https';
import { logger } from '../logger';

/**
 * Direct public Google Fonts TrueType (.ttf) URLs for built-in catalog typography.
 * Pre-resolved for offline reliability and zero API latency.
 */
export const KNOWN_GOOGLE_FONTS_TTF_URLS: Record<string, string> = {
  Anton: 'https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm0K0.ttf',
  Montserrat: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf',
  'Playfair Display': 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf',
  'Bebas Neue': 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXooxW4.ttf',
  'Space Grotesk': 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf',
  Cinzel: 'https://fonts.gstatic.com/s/cinzel/v23/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYo.ttf',
  Righteous: 'https://fonts.gstatic.com/s/righteous/v17/1cXxaUPXBpj2rGoU7C9mjw.ttf',
  Nunito: 'https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshRTM.ttf',
  Syne: 'https://fonts.gstatic.com/s/syne/v22/8vIS7w4qzmVxsWxjBZRjr0FKM_04uT6k.ttf',
  'Archivo Black': 'https://fonts.gstatic.com/s/archivoblack/v21/HTxqL289NzCGg4MzN6KJ7eW6OYs.ttf',
  Oswald: 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiYCSShiA.ttf',
  Inter: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjZ-Ck-8.ttf',
  'Plus Jakarta Sans': 'https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TR_QMquoRg.ttf',
  'Noto Sans Devanagari': 'https://fonts.gstatic.com/s/notosansdevanagari/v25/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly-A.ttf',
  Poppins: 'https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfed3FHGPc.ttf',
};

/**
 * Downloads a single binary file over HTTPS with redirects handling.
 */
function downloadFile(url: string, destPath: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const tempDest = `${destPath}.tmp_${Date.now()}`;
    const file = fs.createWriteStream(tempDest);

    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(tempDest, () => {});
        return downloadFile(res.headers.location, destPath, timeoutMs).then(resolve);
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(tempDest, () => {});
        return resolve(false);
      }

      res.pipe(file);

      file.on('finish', async () => {
        file.close();
        try {
          const stat = await fsp.stat(tempDest);
          if (stat.size > 1000) {
            await fsp.rename(tempDest, destPath);
            resolve(true);
          } else {
            await fsp.unlink(tempDest).catch(() => {});
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      file.close();
      fs.unlink(tempDest, () => {});
      resolve(false);
    });

    req.on('error', () => {
      file.close();
      fs.unlink(tempDest, () => {});
      resolve(false);
    });
  });
}

/**
 * Resolves a dynamic font TTF URL by querying Google Fonts CSS API.
 * Uses an Android user-agent header so that Google Fonts serves TrueType (.ttf) format.
 */
async function queryGoogleFontsTtfUrl(fontFamily: string): Promise<string | null> {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(fontFamily);
    const cssUrl = `https://fonts.googleapis.com/css?family=${encoded}`;

    const req = https.get(
      cssUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; U; Android 4.0; en-us; GT-I9300 Build/IMM76D) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
        },
        timeout: 5000,
      },
      (res) => {
        let css = '';
        res.on('data', (c) => (css += c));
        res.on('end', () => {
          const match = css.match(/url\((https:\/\/[^)]+\.ttf)\)/i);
          resolve(match ? match[1] ?? null : null);
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Returns potential local directories where bundled TrueType fonts may be stored.
 */
function getBundledFontDirs(): string[] {
  const dirs = [
    path.resolve(process.cwd(), 'resources/fonts'),
    path.resolve(__dirname, '../../resources/fonts'),
    path.resolve(__dirname, '../../../resources/fonts'),
  ];
  if (typeof process !== 'undefined' && 'resourcesPath' in process) {
    dirs.push(path.join((process as unknown as { resourcesPath: string }).resourcesPath, 'fonts'));
  }
  return dirs;
}

/**
 * Ensures that all requested font families have physical .ttf files inside fontsDir
 * so that FFmpeg and libass render authentic fonts instead of generic fallbacks.
 */
export async function ensureFontsAvailable(
  fontFamilies: string[],
  fontsDir: string
): Promise<string[]> {
  if (!fs.existsSync(fontsDir)) {
    await fsp.mkdir(fontsDir, { recursive: true });
  }

  const loadedFonts: string[] = [];
  const bundledDirs = getBundledFontDirs();

  for (const rawFamily of fontFamilies) {
    if (!rawFamily) continue;

    // Clean family name (e.g. "'Playfair Display', serif" -> "Playfair Display")
    const cleanFamily = rawFamily.split(',')[0]?.replace(/['"]/g, '').trim();
    if (!cleanFamily) continue;

    const fontFileName = `${cleanFamily.replace(/[\s\W]+/g, '_')}.ttf`;
    const targetPath = path.join(fontsDir, fontFileName);

    // Also check standard name
    const targetStandardPath = path.join(fontsDir, `${cleanFamily}.ttf`);

    // Check if already cached and valid
    if (fs.existsSync(targetPath) || fs.existsSync(targetStandardPath)) {
      loadedFonts.push(cleanFamily);
      continue;
    }

    // 1. Check local bundled directories first for zero-latency, offline operation
    let foundBundled = false;
    for (const bDir of bundledDirs) {
      const candidates = [
        path.join(bDir, `${cleanFamily}.ttf`),
        path.join(bDir, fontFileName),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            await fsp.copyFile(candidate, targetPath);
            if (targetStandardPath !== targetPath) {
              await fsp.copyFile(candidate, targetStandardPath);
            }
            loadedFonts.push(cleanFamily);
            foundBundled = true;
            break;
          } catch {
            // continue fallback
          }
        }
      }
      if (foundBundled) break;
    }

    if (foundBundled) continue;

    // 2. Download from known dictionary or dynamic Google Fonts query
    let ttfUrl = KNOWN_GOOGLE_FONTS_TTF_URLS[cleanFamily];
    if (!ttfUrl) {
      ttfUrl = (await queryGoogleFontsTtfUrl(cleanFamily)) ?? undefined;
    }

    if (ttfUrl) {
      logger.info('FontCache', `Downloading font ${cleanFamily} for FFmpeg export from ${ttfUrl}`);
      const success = await downloadFile(ttfUrl, targetPath);
      if (success) {
        // Also copy to standard name for libass direct font-name lookup
        try {
          if (targetStandardPath !== targetPath && !fs.existsSync(targetStandardPath)) {
            await fsp.copyFile(targetPath, targetStandardPath);
          }
        } catch {
          // ignore copy error
        }
        loadedFonts.push(cleanFamily);
      } else {
        logger.warn('FontCache', `Could not download font TTF for: ${cleanFamily}`);
      }
    }
  }

  return loadedFonts;
}

