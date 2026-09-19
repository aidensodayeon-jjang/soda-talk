/**
 * Web-side Canvas High-Quality Korean & ASCII Text-to-Bitmap Generator
 * Renders anti-aliased, beautifully kerned Korean/English/Emoji text onto an offscreen canvas
 * and serializes the 1-bit pixel bitmap for instant hardware LCD rendering.
 */

export interface TextBitmapPayload {
  action: 'draw_bitmap';
  x: number;
  y: number;
  w: number;
  h: number;
  fg: string;
  bg: string;
  data: string; // Hex-encoded 1-bit pixel stream
  clearScreen?: boolean;
}

let offscreenCanvas: HTMLCanvasElement | null = null;

export function renderTextToBitmapPayload(
  text: string,
  options?: {
    fgColor?: string;
    bgColor?: string;
    screenWidth?: number;
    screenHeight?: number;
    fontSize?: number;
  }
): TextBitmapPayload {
  const sw = options?.screenWidth || 320;
  const sh = options?.screenHeight || 240;
  const fg = options?.fgColor || '#FFFFFF';
  const bg = options?.bgColor || '#090D16';

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
  }
  offscreenCanvas.width = sw;
  offscreenCanvas.height = sh;

  const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { action: 'draw_bitmap', x: 0, y: 0, w: 0, h: 0, fg, bg, data: '' };
  }

  // 1. Clear with background color
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, sw, sh);

  // 2. Determine optimal font size based on text length
  const lines = text.split('\n');
  const maxLineLen = Math.max(...lines.map(l => l.length));
  
  let fontSize = options?.fontSize || 28;
  if (!options?.fontSize) {
    if (lines.length === 1 && maxLineLen <= 6) {
      fontSize = 36;
    } else if (lines.length <= 2 && maxLineLen <= 12) {
      fontSize = 28;
    } else if (lines.length <= 3 && maxLineLen <= 18) {
      fontSize = 22;
    } else {
      fontSize = 18;
    }
  }

  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 3. Draw multiline text centered
  const lineHeight = fontSize * 1.35;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (sh - totalTextHeight) / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, sw / 2, startY + index * lineHeight);
  });

  // 4. Scan pixel data and extract tight bounding box
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Find bounding box containing active pixels
  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Brightness threshold for 1-bit conversion
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness > 80) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  if (!hasPixels) {
    return { action: 'draw_bitmap', x: 0, y: 0, w: sw, h: sh, fg, bg, data: '', clearScreen: true };
  }

  // Add 4px padding around bounding box, clamped to screen
  minX = Math.max(0, minX - 4);
  minY = Math.max(0, minY - 4);
  maxX = Math.min(sw - 1, maxX + 4);
  maxY = Math.min(sh - 1, maxY + 4);

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // 5. Pack bounding box into 1-bit hex stream (MSB first)
  let hexStr = '';
  let currentByte = 0;
  let bitCount = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * sw + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const bit = brightness > 80 ? 1 : 0;

      currentByte = (currentByte << 1) | bit;
      bitCount++;

      if (bitCount === 8) {
        hexStr += currentByte.toString(16).padStart(2, '0');
        currentByte = 0;
        bitCount = 0;
      }
    }
  }

  // Flush remaining bits in last byte if any
  if (bitCount > 0) {
    currentByte = currentByte << (8 - bitCount);
    hexStr += currentByte.toString(16).padStart(2, '0');
  }

  return {
    action: 'draw_bitmap',
    x: minX,
    y: minY,
    w: bw,
    h: bh,
    fg,
    bg,
    data: hexStr,
    clearScreen: true
  };
}
