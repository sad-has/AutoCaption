import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;
const DIAG_DIR = path.join('C:', 'tmp', 'aud', 'diag');
fs.mkdirSync(DIAG_DIR, { recursive: true });
const src = 'C:/tmp/aud/src.mp4';

const style = {
  presetId: 'kinetic-bold',
  fontFamily: 'Arial, sans-serif',
  fontSize: 50,
  fontWeight: 900,
  textColor: '#FFFFFF',
  textTransform: 'uppercase',
  letterSpacing: 1.0,
  lineHeight: 1.05,
  textAlign: 'center',
  maxWidthPercent: 92,
  strokeColor: '#000000',
  strokeWidth: 6,
  hasShadow: true,
  shadowColor: 'rgba(0, 0, 0, 0.9)',
  shadowBlur: 10,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  hasBox: true,
  boxColor: '#0F172A',
  boxOpacity: 0.65,
  boxPaddingX: 16,
  boxPaddingY: 8,
  boxCornerRadius: 10,
  positionYPercent: 24,
  positionXPercent: 50,
  hasWordEmphasis: true,
  activeWordColor: '#F59E0B',
  activeWordScale: 1.12,
  animation: { preset: 'pop', entranceDurationMs: 240, exitDurationMs: 180, intensity: 1.0, wordEmphasis: true },
};

const segments = [
  { id: 'seg-1', startMs: 300, endMs: 1800, text: 'HOW TO BUILD VIRAL REELS',
    words: [
      { id: 'w1', text: 'HOW', startMs: 300, endMs: 700 },
      { id: 'w2', text: 'TO', startMs: 700, endMs: 1100 },
      { id: 'w3', text: 'BUILD', startMs: 1100, endMs: 1500 },
      { id: 'w4', text: 'VIRAL', startMs: 1500, endMs: 1800 },
    ]},
  { id: 'seg-2', startMs: 2000, endMs: 3800, text: 'नमस्ते दुनिया',
    words: [
      { id: 'w5', text: 'नमस्ते', startMs: 2000, endMs: 2800 },
      { id: 'w6', text: 'दुनिया', startMs: 2800, endMs: 3800 },
    ]},
];

// 1) Generate ASS directly
const { exportToAss } = await import('./src/shared/export/subtitles.ts');
const ass = exportToAss({ segments, style, videoWidth: 1080, videoHeight: 1920, title: 'Diag', enableWordEmphasis: true });
fs.writeFileSync(path.join(DIAG_DIR, 'diag.ass'), ass, 'utf-8');
console.log('=== ASS dialogue lines ===');
console.log(ass.split('\n').filter(l => l.startsWith('Dialogue:')).slice(0, 10).join('\n'));
console.log('\n=== Render ASS onto video ===');
const r = spawnSync(ffmpeg, ['-y','-i', src, '-vf', `ass=${path.join(DIAG_DIR, 'diag.ass')}`, '-c:v','libx264','-crf','20','-c:a','aac','-b:a','128k', path.join(DIAG_DIR, 'diag_out.mp4')], {encoding:'utf-8'});
console.log('exit', r.status);
console.log(r.stderr.slice(-1500));
console.log('=== probe ===');
const { inspectMediaFile } = await import('./src/main/media/prober.ts');
const p = await inspectMediaFile(path.join(DIAG_DIR, 'diag_out.mp4'));
console.log(JSON.stringify(p, null, 2));