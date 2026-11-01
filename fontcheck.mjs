import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;

function esc(p) { let e = p.replace(/\\/g, '/'); e = e.replace(/:/g, '\\:'); e = e.replace(/'/g, "\\'"); return e; }

const r = spawnSync(ffmpeg, ['-y','-i','C:/tmp/aud/distinct.mp4','-vf',`ass='${esc('C:/tmp/aud/diag5.ass')}':fontsdir='${esc('C:/tmp/aud/autocaption_fonts')}'`,'-frames:v','1','-f','null','-'], {encoding:'utf-8'});
const lines = r.stderr.split('\n');
const fontLines = lines.filter(l => /font|libass|Font|ASS|Style|Glyph|sub|select/i.test(l));
console.log('=== FONT/LIBASS LINES ===');
console.log(fontLines.slice(0, 40).join('\n'));
console.log('=== ALL STDERR (last 60 lines) ===');
console.log(lines.slice(-60).join('\n'));