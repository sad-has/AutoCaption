import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;
const src = 'C:/tmp/aud/src.mp4';
const DIAG_DIR = path.join('C:', 'tmp', 'aud', 'diag2');
fs.mkdirSync(DIAG_DIR, { recursive: true });

function escapeFFmpegFilterPath(filePath) {
  let escaped = filePath.replace(/\\/g, '/');
  escaped = escaped.replace(/:/g, '\\:');
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}

const assPath = path.join(DIAG_DIR, 'diag.ass');
const fontsDir = path.join('C:', 'tmp', 'aud', 'autocaption_fonts');
fs.mkdirSync(fontsDir, { recursive: true });

const vf = `ass='${escapeFFmpegFilterPath(assPath)}':fontsdir='${escapeFFmpegFilterPath(fontsDir)}'`;
console.log('VF:', vf);

const r = spawnSync(ffmpeg, ['-y','-i', src, '-vf', vf, '-c:v','libx264','-crf','20','-c:a','aac','-b:a','128k', path.join(DIAG_DIR, 'out.mp4')], {encoding:'utf-8'});
console.log('exit', r.status);
console.log('STDERR TAIL:', r.stderr.slice(-800));
console.log('OUT EXISTS:', fs.existsSync(path.join(DIAG_DIR, 'out.mp4')));
if (fs.existsSync(path.join(DIAG_DIR, 'out.mp4'))) {
  console.log('SIZE:', fs.statSync(path.join(DIAG_DIR, 'out.mp4')).size);
}