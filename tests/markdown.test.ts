import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, noteToMarkdown, slugify } from '../src/lib/markdown';
import { NOTE_RICHE } from './fixtures';

describe('htmlToMarkdown', () => {
  it('convertit les titres', () => {
    expect(htmlToMarkdown('<h1>A</h1>')).toBe('# A');
    expect(htmlToMarkdown('<h2>B</h2>')).toBe('## B');
    expect(htmlToMarkdown('<h3>C</h3>')).toBe('### C');
  });

  it('convertit gras, italique, barré et surlignage', () => {
    expect(htmlToMarkdown('<div><span style="font-weight: bold;">g</span></div>')).toBe('**g**');
    expect(htmlToMarkdown('<div><em>i</em></div>')).toBe('*i*');
    expect(htmlToMarkdown('<div><span style="text-decoration-line: line-through;">b</span></div>')).toBe(
      '~~b~~'
    );
    expect(
      htmlToMarkdown('<div><span style="background-color: rgb(129, 121, 98);">s</span></div>')
    ).toBe('==s==');
  });

  it('convertit les listes à puces et numérotées', () => {
    expect(htmlToMarkdown('<ul><li>un</li><li>deux</li></ul>')).toBe('- un\n- deux');
    expect(htmlToMarkdown('<ol><li>un</li><li>deux</li></ol>')).toBe('1. un\n2. deux');
  });

  it('garde les cases à cocher comme tâches', () => {
    const html =
      '<div class="task-line" data-checked="true">fait</div>' +
      '<div class="task-line" data-checked="false">à faire</div>';
    expect(htmlToMarkdown(html)).toBe('- [x] fait\n- [ ] à faire');
  });

  it('ignore les balises inconnues mais garde le texte', () => {
    expect(htmlToMarkdown('<div><u>souligné</u></div>')).toBe('<u>souligné</u>');
  });

  it('nettoie les espaces et les lignes vides en trop', () => {
    expect(htmlToMarkdown('<div>a</div><div><br></div><div>b</div>')).toBe('a\n\nb');
  });

  it('gère une note complète sans planter', () => {
    const md = htmlToMarkdown(NOTE_RICHE.html);
    expect(md).toContain('# Un titre');
    expect(md).toContain('**gras**');
    expect(md).toContain('==surligné==');
    expect(md).toContain('- Puce une');
    expect(md).toContain('1. Première');
    expect(md).toContain('- [x] Tâche faite');
    expect(md).toContain('![](');
    expect(md).not.toContain('<audio');
  });

  it('renvoie une chaîne vide pour du contenu vide', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});

describe('noteToMarkdown', () => {
  it('préfixe avec le titre en H1', () => {
    expect(noteToMarkdown('Ma note', '<div>texte</div>')).toBe('# Ma note\n\ntexte\n');
  });

  it("n'ajoute pas de titre vide", () => {
    expect(noteToMarkdown('   ', '<div>texte</div>')).toBe('texte\n');
  });
});

describe('slugify', () => {
  it('retire les accents et les caractères spéciaux', () => {
    expect(slugify('Note très riche ! 2026')).toBe('note-tres-riche-2026');
  });

  it('utilise un repli quand il ne reste rien', () => {
    expect(slugify('!!!', 'note')).toBe('note');
  });
});
