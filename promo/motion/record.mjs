// Renders index.html frame-by-frame into an MP4 (needs playwright-core + ffmpeg).
//   node record.mjs out.mp4            → full video, 30fps
//   node record.mjs stills 1.5 9 16    → PNG stills at those seconds
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = 'soda_promo_studio.mp4', ...times] = process.argv.slice(2);
const FPS = 30;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.goto('file://' + path.join(here, process.env.PROMO_HTML || 'index.html') + '?record');
await page.evaluate(() => window.ready);
const frame = t => page.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/jpeg', .93); }, t)
  .then(u => Buffer.from(u.split(',')[1], 'base64'));

if (mode === 'stills') {
  for (const t of times) writeFileSync(path.join(here, `still_${t}.jpg`), await frame(+t));
} else {
  const dur = await page.evaluate(() => DUR);
  const wav = path.join(here, 'soundtrack.wav'); // from soundtrack.py, muxed in when present
  const audio = existsSync(wav) ? ['-i', wav, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.resolve(here, '..', mode)],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < dur * FPS; i++) {
    if (!ff.stdin.write(await frame(i / FPS))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
