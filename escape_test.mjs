import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = typeof ffmpegStatic === 'string' ? ffmpegStatic : ffmpegStatic.default;
const src = 'C:/tmp/aud/src.mp4';
const assPath = 'C:/tmp/aud/diag/diag.ass';

function escapeFFmpegFilterPath(filePath) {
  let escaped = filePath.replace(/\\/g, '/');
  escaped = escaped.replace(/:/g, '\\:');
  escaped = escaped.replace(/'/g, "\\'");
  return escaped;
}

const variants = {
  'raw': `ass=${assPath}`,
  'escaped-no-quotes': `ass=${escapeFFmpegFilterPath(assPath)}`,
  'escaped-quotes': `ass='${escapeFFmpegFilterPath(assPath)}'`,
  'escaped-quotes-fd': `ass='${escapeFFmpegFilterPath(assPath)}':fontsdir='C\\:/tmp/aud/autocaption_fonts'`,
};

for (const [name, vf] of Object.entries(variants)) {
  console.log(`\n=== ${name} ===`);
  console.log('VF:', vf);
  const r = spawnSync(ffmpeg, ['-y','-i', src, '-vf', vf, '-frames:v','1', '-c:v','libx264','-f','null','-'], {encoding:'utf-8'});
  console.log('exit', r.status);
  const err = r.stderr.split('\n').filter(l => l.includes('Error') || l.includes('Unable') || l.includes('ass')).slice(0,3).join(' | ');
  console.log('err:', err || '(none)');
}