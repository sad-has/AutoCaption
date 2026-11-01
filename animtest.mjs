import fs from 'fs';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;
const { exportToAss } = await import('./src/shared/export/subtitles.ts');

// Test: Hindi + pop animation + box + bold
const style = {
  presetId: 'kinetic-bold', fontFamily: 'Arial, sans-serif', fontSize: 54, fontWeight: 900,
  textColor: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.05,
  textAlign: 'center', maxWidthPercent: 90, strokeColor: '#000000', strokeWidth: 4,
  hasShadow: true, shadowColor: 'rgba(0, 0, 0, 0.85)', shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 3,
  hasBox: true, boxColor: '#0F172A', boxOpacity: 0.7, boxPaddingX: 16, boxPaddingY: 8, boxCornerRadius: 8,
  positionYPercent: 22, positionXPercent: 50, hasWordEmphasis: true, activeWordColor: '#F59E0B',
  activeWordScale: 1.15,
  animation: { preset: 'pop', entranceDurationMs: 300, exitDurationMs: 200, intensity: 1.0, wordEmphasis: true },
};
const segments = [
  { id: 's1', startMs: 400, endMs: 2200, text: 'VIRAL REELS',
    words: [{id:'w1',text:'VIRAL',startMs:400,endMs:1200},{id:'w2',text:'REELS',startMs:1200,endMs:2200}] },
  { id: 's2', startMs: 2600, endMs: 4200, text: 'नमस्ते दुनिया',
    words: [{id:'w3',text:'नमस्ते',startMs:2600,endMs:3300},{id:'w4',text:'दुनिया',startMs:3300,endMs:4200}] },
];
const ass = exportToAss({ segments, style, videoWidth: 1080, videoHeight: 1920, title: 'AnimTest', enableWordEmphasis: true });
fs.writeFileSync('C:/tmp/aud/anim.ass', ass, 'utf-8');
console.log(ass);

function esc(p) { let e = p.replace(/\\/g, '/'); e = e.replace(/:/g, '\\:'); e = e.replace(/'/g, "\\'"); return e; }

// Render with pop animation
const vf = `ass='${esc('C:/tmp/aud/anim.ass')}':fontsdir='${esc('C:/tmp/aud/autocaption_fonts')}'`;
const r = spawnSync(ffmpeg, ['-y','-i','C:/tmp/aud/distinct.mp4','-vf',vf,'-c:v','libx264','-crf','18','-c:a','aac','-b:a','128k','C:/tmp/aud/anim_out.mp4'], {encoding:'utf-8'});
console.log('render exit', r.status, 'size', fs.statSync('C:/tmp/aud/anim_out.mp4').size);

// Extract frames at key timestamps
for (const t of [0.2, 0.5, 0.9, 1.4, 1.8, 3.0, 3.6, 4.0]) {
  spawnSync(ffmpeg, ['-y','-ss', String(t),'-i','C:/tmp/aud/anim_out.mp4','-frames:v','1','-q:v','2',`C:/tmp/aud/a_${t}.png`], {encoding:'utf-8'});
}
console.log('done');