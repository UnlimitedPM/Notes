import { slugify } from './markdown';

export interface NoteShotOptions {
  title: string;
  meta: string;
  html: string;
  dark: boolean;
  /** Largeur logique de la carte en px CSS. */
  width?: number;
}

const FONT_STACK =
  "'MiSans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Rend la note en PNG (carte titre + date + contenu) via un SVG <foreignObject>.
 * Tout est en ligne (CSS + images data:) : le SVG ne dépend d'aucune feuille externe.
 */
export async function renderNoteImage(options: NoteShotOptions): Promise<Blob> {
  const width = options.width ?? 393;
  const scale = 3;
  const bg = options.dark ? '#000000' : '#ffffff';
  const fg = options.dark ? '#ffffff' : '#111114';
  const muted = options.dark ? '#8a8a90' : '#9b9ba3';
  const hl = options.dark ? '#817962' : '#FFE58A';

  const holder = document.createElement('div');
  holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  holder.style.cssText = `width:${width}px;padding:26px 24px 32px;box-sizing:border-box;background:${bg};color:${fg};font-family:${FONT_STACK};`;
  holder.innerHTML = options.html;

  // Les cases à cocher passent en caractères (les pseudo-éléments ne sont pas fiables en SVG).
  holder.querySelectorAll<HTMLElement>('.task-line').forEach((line) => {
    const checked = line.getAttribute('data-checked') === 'true';
    const text = (line.textContent ?? '').replace(/\u200b/g, '');
    line.textContent = `${checked ? '☑' : '☐'} ${text}`;
    line.removeAttribute('data-checked');
    line.classList.remove('task-line');
  });
  holder.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.style && el.style.backgroundColor === 'transparent') el.style.backgroundColor = '';
  });

  const titleHtml = options.title.trim()
    ? `<h1 class="shot-title">${escapeHtml(options.title.trim())}</h1>`
    : '';
  const metaHtml = options.meta ? `<div class="shot-meta">${escapeHtml(options.meta)}</div>` : '';

  const css = `
    .shot-title{margin:0 0 6px;font-size:32px;font-weight:700;line-height:1.2;letter-spacing:-.5px;}
    .shot-meta{font-size:13px;color:${muted};margin-bottom:22px;}
    .shot-body{font-size:19px;line-height:1.58;overflow-wrap:anywhere;}
    .shot-body div + div{margin-top:9px;}
    .shot-body h1{font-size:27px;font-weight:700;margin:14px 0 4px;line-height:1.35;}
    .shot-body h2{font-size:23px;font-weight:700;margin:12px 0 4px;line-height:1.35;}
    .shot-body h3{font-size:21px;font-weight:600;margin:10px 0 3px;line-height:1.35;}
    .shot-body ul,.shot-body ol{margin:6px 0;padding-left:26px;}
    .shot-body li{margin:3px 0;}
    .shot-body img{display:block;max-width:100%;height:auto;margin:12px 0;border-radius:14px;}
    .shot-body span[style*="background-color"]{border-radius:2px;}
    .shot-tag{margin-top:26px;font-size:12px;color:${muted};}
  `;

  // Mesure de la hauteur réelle.
  const measure = document.createElement('div');
  measure.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  measure.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;padding:26px 24px 32px;box-sizing:border-box;font-family:${FONT_STACK};`;
  measure.innerHTML = `<style>${css}</style>${titleHtml}${metaHtml}<div class="shot-body">${holder.innerHTML}</div>`;
  document.body.appendChild(measure);
  const height = Math.max(120, Math.ceil(measure.getBoundingClientRect().height));
  const bodyHtml = measure.innerHTML;
  measure.remove();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <foreignObject x="0" y="0" width="${width}" height="${height}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${bg};color:${fg};font-family:${FONT_STACK};">${bodyHtml}</div>
    </foreignObject>
  </svg>`;

  const image = new Image();
  image.decoding = 'sync';
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const cropped = trimBottom(canvas, bg, scale, 28);
  const blob = await new Promise<Blob | null>((resolve) => cropped.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('image vide');
  // évite un surlignage du mauvais thème dans l'export
  void hl;
  return blob;
}

/** Coupe la zone vide en bas (la hauteur mesurée peut être trop grande). */
function trimBottom(source: HTMLCanvasElement, bg: string, scale: number, padding: number): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) return source;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  const base = hexToRgb(bg);

  let lastContentRow = 0;
  for (let y = height - 1; y >= 0; y -= 1) {
    let hasContent = false;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (
        Math.abs(data[i] - base[0]) > 8 ||
        Math.abs(data[i + 1] - base[1]) > 8 ||
        Math.abs(data[i + 2] - base[2]) > 8
      ) {
        hasContent = true;
        break;
      }
    }
    if (hasContent) {
      lastContentRow = y;
      break;
    }
  }

  const target = Math.min(height, lastContentRow + Math.round(padding * scale));
  if (target >= height) return source;

  const out = document.createElement('canvas');
  out.width = width;
  out.height = Math.max(1, target);
  const outCtx = out.getContext('2d');
  if (!outCtx) return source;
  outCtx.fillStyle = bg;
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(source, 0, 0, width, target, 0, 0, width, target);
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Partage natif d'un fichier, sinon téléchargement. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title });
    return 'shared';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function imageFilename(title: string): string {
  return `${slugify(title, 'note')}.png`;
}

export function markdownFilename(title: string): string {
  return `${slugify(title, 'note')}.md`;
}
