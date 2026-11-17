import { describe, expect, it } from 'vitest';
import { isTaskLine, parseTasks, setTaskTextAt, taskLineHtml, toggleTaskAt } from '../src/lib/tasks';

const HTML =
  '<div>intro</div>' +
  '<div class="task-line" data-checked="false">un</div>' +
  '<div class="task-line" data-checked="true">deux</div>';

describe('parseTasks', () => {
  it('extrait le texte et l’état de chaque ligne de case', () => {
    const tasks = parseTasks(HTML);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ text: 'un', done: false });
    expect(tasks[1]).toMatchObject({ text: 'deux', done: true });
  });

  it('renvoie un tableau vide sans case', () => {
    expect(parseTasks('<div>rien</div>')).toEqual([]);
  });
});

describe('toggleTaskAt', () => {
  it('coche puis décoche la bonne ligne', () => {
    const coche = toggleTaskAt(HTML, 0);
    expect(parseTasks(coche)[0].done).toBe(true);
    expect(parseTasks(coche)[1].done).toBe(true);

    const decoche = toggleTaskAt(coche, 0);
    expect(parseTasks(decoche)[0].done).toBe(false);
  });

  it('ne touche pas au HTML quand l’index est hors limites', () => {
    expect(toggleTaskAt(HTML, 99)).toBe(HTML);
  });

  it('laisse le reste du texte intact', () => {
    expect(toggleTaskAt(HTML, 0)).toContain('<div>intro</div>');
  });
});

describe('setTaskTextAt', () => {
  it('remplace le texte de la ligne visée', () => {
    const next = setTaskTextAt(HTML, 1, 'modifié');
    expect(parseTasks(next)[1].text).toBe('modifié');
    expect(parseTasks(next)[0].text).toBe('un');
  });

  it('échappe le HTML saisi', () => {
    const next = setTaskTextAt(HTML, 0, '<b>gras</b>');
    expect(parseTasks(next)[0].text).toBe('<b>gras</b>');
    expect(next).not.toContain('<b>gras</b>');
  });
});

describe('taskLineHtml', () => {
  it('construit une ligne cochée ou non', () => {
    expect(taskLineHtml('abc', false)).toContain('data-checked="false"');
    expect(taskLineHtml('abc', true)).toContain('data-checked="true"');
    expect(taskLineHtml('abc')).toContain('abc');
  });

  it('échappe les caractères spéciaux', () => {
    expect(taskLineHtml('<img src=x>')).not.toContain('<img');
  });
});

describe('isTaskLine', () => {
  it('reconnaît une ligne de case', () => {
    const doc = new DOMParser().parseFromString(HTML, 'text/html');
    const lines = doc.querySelectorAll('div');
    expect(isTaskLine(lines[1])).toBe(true);
    expect(isTaskLine(lines[0])).toBe(false);
    expect(isTaskLine(null)).toBe(false);
  });
});
