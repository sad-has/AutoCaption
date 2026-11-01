import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;

// Create a DISTINCTIVE source: gradient + text so we can verify original preservation
const src = 'C:/tmp/aud/distinct.mp4';
const vf = 'gradient=colors=red:blue:yellow:green:direction=diagonal,drawtext=text=ORIGINAL:fontcolor=white:fontsize=48:x=(w-text_w)/2:y=20';
spawnSync(ffmpeg, ['-y','-f','lavfi','-i',`color=c=0x000000:s=720x1280:d=4:r=30`,'-vf',vf,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k', src], {encoding:'utf-8'});
console.log('src exists:', fs.existsSync(src), fs.statSync(src).size);

const { exportToAss } = await import('./src/shared/export/subtitles.ts');
const style = {
  presetId: 'kinetic-bold', fontFamily: 'Arial, sans-serif', fontSize: 50, fontWeight: 900,
  textColor: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1.0, lineHeight: 1.05,
  textAlign: 'center', maxWidthPercent: 92, strokeColor: '#000000', strokeWidth: 6,
  hasShadow: true, shadowColor: 'rgba(0, 0, 0, 0.9)', shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 4,
  hasBox: true, boxColor: '#0F172A', boxOpacity: 0.65, boxPaddingX: 16, boxPaddingY: 8, boxCornerRadius: 10,
  positionYPercent: 24, positionXPercent: 50, hasWordEmphasis: true, activeWordColor: '#F59E0B',
  activeWordScale: 1.12,
  animation: { preset: 'pop', entranceDurationMs: 240, exitDurationMs: 180, intensity: 1.0, wordEmphasis: true },
};
const segments = [
  { id: 'seg-1', startMs: 300, endMs: 1800, text: 'HOW TO BUILD VIRAL REELS',
    words: [{id:'w1',text:'HOW',startMs:300,endMs:700},{id:'w2',text:'TO',startMs:700,endMs:1100},{id:'w3',text:'BUILD',startMs:1100,endMs:1500},{id:'w4',text:'VIRAL',startMs:1500,endMs:1800}] },
];
const ass = exportToAss({ segments, style, videoWidth: 1080, videoHeight: 1920, title: 'Diag', enableWordEmphasis: true });
const assPath = 'C:/tmp/aud/diag5.ass';
fs.writeFileSync(assPath, ass, 'utf-8');

function escapeFFmpegFilterPath(filePath) {
  let escaped = filePath.replace(/\\/g, '/');
  escaped = escaped.replace(/:/g, '\\:');
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}
const fontsDir = 'C:/tmp/aud/autocaption_fonts';
fs.mkdirSync(fontsDir, { recursive: true });
const vfArg = `ass='${escapeFFmpegFilterPath(assPath)}':fontsdir='${escapeFFmpegFilterPath(fontsDir)}'`;
console.log('VF:', vfArg);

const out = 'C:/tmp/aud/distinct_out.mp4';
const r = spawnSync(ffmpeg, ['-y','-i', src, '-vf', vfArg, '-c:v','libx264','-crf','20','-c:a','aac','-b:a','128k', out], {encoding:'utf-8'});
console.log('render exit', r.status);
console.log('OUT SIZE:', fs.statSync(out).size);

// Extract frames at t=0.0 (before caption), t=1.0 (caption active), t=3.5 (after caption)
for (const t of [0.0, 1.0, 3.5]) {
  const framePath = `C:/tmp/aud/frame_${t}.png`;
  spawnSync(ffmpeg, ['-y','-ss', String(t),'-i', out, '-frames:v','1', '-q:v','2', framePath], {encoding:'utf-8'});
  console.log(`frame t=${t}:`, fs.existsSync(framePath), fs.statSync(framePath)?.size);
}
// Also extract source frame at t=1.0 for comparison
const srcFrame = 'C:/tmp/aud/src_frame_1.png';
spawnSync(ffmpeg, ['-y','-ss','1.0','-i', src, '-frames:v','1', '-q:v','2', srcFrame], {encoding:'utf-8'});
console.log('src frame t=1.0:', fs.statSync(srcFrame).size);