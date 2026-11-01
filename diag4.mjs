import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;

// Reproduce EXACTLY what videoExporter.ts builds (current code)
function escapeFFmpegFilterPath(filePath) {
  let escaped = filePath.replace(/\\/g, '/');
  escaped = escaped.replace(/:/g, '\\:');
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}
const assPath = 'C:/tmp/aud/diag/diag.ass';
const fontsDir = 'C:/tmp/aud/autocaption_fonts';
fs.mkdirSync(fontsDir, { recursive: true });
const escapedAss = escapeFFmpegFilterPath(assPath);
const escapedFontsDir = escapeFFmpegFilterPath(fontsDir);
const vfParts = [
  `ass='${escapedAss}':fontsdir='${escapedFontsDir}'`,
];
const vfArg = vfParts.join(',');
console.log('PRODUCTION VF:', vfArg);

const r = spawnSync(ffmpeg, ['-y','-i','C:/tmp/aud/src.mp4','-vf',vfArg,'-c:v','libx264','-crf','20','-c:a','aac','-b:a','128k','C:/tmp/aud/diag4_out.mp4'], {encoding:'utf-8'});
console.log('exit', r.status);
console.log('STDERR TAIL:', r.stderr.slice(-500));
console.log('OUT EXISTS:', fs.existsSync('C:/tmp/aud/diag4_out.mp4'));
if (fs.existsSync('C:/tmp/aud/diag4_out.mp4')) {
  console.log('SIZE:', fs.statSync('C:/tmp/aud/diag4_out.mp4').size);
}