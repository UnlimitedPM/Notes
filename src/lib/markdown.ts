/**
 * Conversion d'une note HTML (celle de l'éditeur) en Markdown.
 * Gère ce que l'éditeur sait produire : titres H1-H3, gras, italique, barré,
 * souligné, surlignage, puces, listes numérotées, cases à cocher, images.
 */

function wrap(marker: string, inner: string): string {
  const text = inner.trim();
  if (!text) return inner;
  return `${marker}${text}${marker}`;
}

function decoration(el: HTMLElement): string {
  return el.style?.textDecorationLine || el.style?.textDecoration || '';
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? '').replace(/\u200b/g, '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName;

  if (tag === 'BR') return '\n';
  if (tag === 'IMG') {
    const src = el.getAttribute('src') ?? '';
    const alt = el.getAttribute('alt') ?? '';
    return src ? `\n![${alt}](${src})\n` : '';
  }
  if (tag === 'HR') return '\n---\n';

  const inner = Array.from(el.childNodes)
    .map(inlineMarkdown)
    .join('');

  if (tag === 'STRONG' || tag === 'B') return wrap('**', inner);
  if (tag === 'EM' || tag === 'I') return wrap('*', inner);
  if (tag === 'CODE') return inner ? `\`${inner}\`` : inner;

  let out = inner;
  const deco = decoration(el);
  if (deco.includes('line-through')) out = wrap('~~', out);
  if (deco.includes('underline')) out = `<u>${out}</u>`;
  if (el.style?.fontStyle === 'italic') out = wrap('*', out);
  const weight = el.style?.fontWeight ?? '';
  if (weight === 'bold' || Number(weight) >= 600) out = wrap('**', out);
  const bg = el.style?.backgroundColor;
  if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) out = wrap('==', out);
  return out;
}

function listMarkdown(list: HTMLElement): string {
  const ordered = list.tagName === 'OL';
  let index = 0;
  const lines: string[] = [];
  for (const child of Array.from(list.children)) {
    if (child.tagName !== 'LI') continue;
    const li = child as HTMLElement;
    const nested = Array.from(li.children).filter((c) => /^(UL|OL)$/.test(c.tagName));
    for (const n of nested) n.remove();
    index += 1;
    const marker = ordered ? `${index}.` : '-';
    const content = inlineMarkdown(li).replace(/\n+/g, ' ').trim();
    lines.push(`${marker} ${content}`.trimEnd());
    for (const n of nested) {
      const sub = listMarkdown(n as HTMLElement)
        .split('\n')
        .filter(Boolean)
        .map((line) => `  ${line}`)
        .join('\n');
      if (sub) lines.push(sub);
    }
  }
  return lines.join('\n');
}

function taskLineMarkdown(el: HTMLElement): string {
  const checked = el.getAttribute('data-checked') === 'true';
  const content = inlineMarkdown(el).replace(/\n+/g, ' ').trim();
  return `${checked ? '- [x]' : '- [ ]'} ${content}`.trimEnd();
}

function blocksMarkdown(parent: Element): string {
  const parts: string[] = [];
  let lastWasTask = false;

  const push = (value: string, isTask = false) => {
    const text = value.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return;
    if (isTask && lastWasTask && parts.length) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}\n${text}`;
    } else {
      parts.push(text);
    }
    lastWasTask = isTask;
  };

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      push((child.textContent ?? '').replace(/\u200b/g, ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    const tag = el.tagName;

    if (tag === 'H1') push(`# ${inlineMarkdown(el).replace(/\n+/g, ' ').trim()}`);
    else if (tag === 'H2') push(`## ${inlineMarkdown(el).replace(/\n+/g, ' ').trim()}`);
    else if (tag === 'H3') push(`### ${inlineMarkdown(el).replace(/\n+/g, ' ').trim()}`);
    else if (tag === 'UL' || tag === 'OL') push(listMarkdown(el));
    else if (el.classList.contains('task-line')) push(taskLineMarkdown(el), true);
    else if (tag === 'IMG') {
      const src = el.getAttribute('src') ?? '';
      if (src) push(`![](${src})`);
    } else if (tag === 'HR') push('---');
    else if (el.querySelector('ul, ol, h1, h2, h3, div, p')) push(blocksMarkdown(el));
    else push(inlineMarkdown(el));
  }

  return parts.join('\n\n');
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<body><div id="root">${html}</div></body>`,
    'text/html'
  );
  const root = doc.getElementById('root');
  if (!root) return '';
  return blocksMarkdown(root)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function noteToMarkdown(title: string, html: string): string {
  const body = htmlToMarkdown(html);
  const heading = title.trim() ? `# ${title.trim()}` : '';
  return [heading, body].filter(Boolean).join('\n\n') + '\n';
}

export function slugify(text: string, fallback = 'note'): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return slug || fallback;
}
