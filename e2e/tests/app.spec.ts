import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
});

test('affiche la liste des notes de démonstration', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Bienvenue dans Notes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle note' })).toBeVisible();
});

test('crée une note, la retrouve après rechargement', async ({ page }) => {
  await page.getByRole('button', { name: 'Nouvelle note' }).click();

  await page.getByPlaceholder('Titre').fill('Ma note E2E');
  const body = page.getByRole('textbox', { name: 'Contenu de la note' });
  await body.click();
  await page.keyboard.type('Bonjour depuis Playwright');

  await page.getByRole('button', { name: "Terminer l'édition" }).click();
  await expect(page.getByRole('button', { name: 'Retour' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();

  await expect(page.getByRole('heading', { name: 'Ma note E2E' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ma note E2E' })).toBeVisible();
});

test('ajoute une tâche depuis l’onglet Tâches', async ({ page }) => {
  await page.getByRole('button', { name: 'Tâches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tâches', level: 1 })).toBeVisible();

  const tasks = page.locator('textarea.task-input');
  const before = await tasks.count();

  await page.getByRole('button', { name: 'Nouvelle tâche' }).click();
  const composer = page.getByPlaceholder(/Appuyez sur .Entrée. pour créer des sous-tâches/);
  await composer.fill('Acheter du pain');
  await composer.press('Enter');

  await expect(tasks).toHaveCount(before + 1);
  await expect(tasks.first()).toHaveValue('Acheter du pain');

  await page.reload();
  await page.getByRole('button', { name: 'Tâches', exact: true }).click();
  await expect(tasks.first()).toHaveValue('Acheter du pain');
});

test('ouvre l’app sur une URL profonde (repli SPA)', async ({ page }) => {
  const response = await page.goto('/une/route/profonde');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
});

test('ouvre les réglages et affiche la version', async ({ page }) => {
  await page.getByRole('button', { name: 'Paramètres' }).click();

  await expect(page.getByText('Version', { exact: true })).toBeVisible();
  await expect(page.getByText(/^0\.\d+\.\d+$/)).toBeVisible();
});
