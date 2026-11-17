import { describe, expect, it } from 'vitest';
import { inlineMdToHtml, mdToHtml } from '../src/lib/md';
import { htmlToMarkdown } from '../src/lib/markdown';
import { NOTE_RICHE } from './fixtures';

/** html → md → html → md : le second Markdown doit être identique au premier. */
function roundTrip(html: string): { md1: string; md2: string } {
  const md1 = htmlToMarkdown(html);
  const back = mdToHtml(md1);
  return { md1, md2: htmlToMarkdown(back) };
}

describe('mdToHtml', () => {
  it('rend les titres', () => {
    expect(mdToHtml('# A\n\n## B\n\n### C')).toBe('<h1>A</h1><h2>B</h2><h3>C</h3>');
  });

  it('rend les marques inline', () => {
    expect(inlineMdToHtml('**g**')).toBe('<span style="font-weight: bold;">g</span>');
    expect(inlineMdToHtml('*i*')).toBe('<span style="font-style: italic;">i</span>');
    expect(inlineMdToHtml('~~b~~')).toBe(
      '<span style="text-decoration-line: line-through;">b</span>'
    );
    expect(inlineMdToHtml('==s==')).toContain('background-color: #FFE58A');
    expect(inlineMdToHtml('<u>u</u>')).toBe('<u>u</u>');
  });

  it('échappe le HTML des notes (pas d’injection)', () => {
    expect(mdToHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });

  it('rend les listes, y compris une sous-liste', () => {
    expect(mdToHtml('- un\n- deux')).toBe('<ul><li>un</li><li>deux</li></ul>');
    expect(mdToHtml('1. un\n2. deux')).toBe('<ol><li>un</li><li>deux</li></ol>');
    expect(mdToHtml('- un\n  - sous')).toBe('<ul><li>un<ul><li>sous</li></ul></li></ul>');
  });

  it('rend les cases à cocher comme lignes de tâche', () => {
    expect(mdToHtml('- [x] fait\n- [ ] à faire')).toBe(
      '<div class="task-line" data-checked="true">fait</div>' +
        '<div class="task-line" data-checked="false">à faire</div>'
    );
  });

  it('rend une image et un audio', () => {
    expect(mdToHtml('![alt](data:image/png;base64,AA)')).toBe(
      '<div><img src="data:image/png;base64,AA" alt="alt" /></div>'
    );
    expect(mdToHtml('<audio src="data:audio/webm;base64,BB"></audio>')).toBe(
      '<audio controls src="data:audio/webm;base64,BB"></audio>'
    );
  });
});

describe('aller-retour HTML → Markdown → HTML', () => {
  it('est stable sur la note riche (titres, styles, listes, cases, média)', () => {
    const { md1, md2 } = roundTrip(NOTE_RICHE.html);
    expect(md2).toBe(md1);
    expect(md1).toContain('# Un titre');
    expect(md1).toContain('**gras**');
    expect(md1).toContain('~~barré~~');
    expect(md1).toContain('==surligné==');
    expect(md1).toContain('- [x] Tâche faite');
    expect(md1).toContain('](data:image/png');
    expect(md1).toContain('<audio src="data:audio/wav');
  });

  it('survit à deux conversions successives', () => {
    const html = '<div>a</div><ul><li>un</li></ul><div class="task-line" data-checked="false">t</div>';
    const once = htmlToMarkdown(html);
    const twice = htmlToMarkdown(mdToHtml(once));
    expect(twice).toBe(once);
  });

  it('ne perd pas une note vocale', () => {
    const html = '<div><audio controls src="data:audio/webm;base64,CCC"></audio></div>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('<audio src="data:audio/webm;base64,CCC"></audio>');
    expect(htmlToMarkdown(mdToHtml(md))).toBe(md);
  });
});
