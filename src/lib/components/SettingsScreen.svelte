<script lang="ts">
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import { notesStore } from '../notes.svelte';
  import { confirmStore } from '../confirm.svelte';
  import type { LayoutKey, SortKey, TextSizeKey, ThemeKey } from '../types';
  import { toast } from '../toast.svelte';
  import pkg from '../../../package.json';
  import { TEST_PAYLOAD } from '../testFixtures';

  type SheetName =
    | 'size'
    | 'sort'
    | 'layout'
    | 'theme'
    | 'cloud'
    | 'quick'
    | 'privacy'
    | null;

  interface Props {
    onclose: () => void;
    ontrash: () => void;
  }

  let { onclose, ontrash }: Props = $props();

  let sheet = $state<SheetName>(null);
  let scrolled = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  const devMode = import.meta.env.DEV;

  // Injectée par vite.config.ts (`define`) depuis package.json.
  const appVersion = pkg.version;

  const sizeLabels: Record<TextSizeKey, string> = {
    small: 'Petite',
    medium: 'Moyenne',
    large: 'Grande'
  };
  const sortLabels: Record<SortKey, string> = {
    updated: 'Par date de modification',
    created: 'Par date de création',
    title: 'Par titre'
  };
  const layoutLabels: Record<LayoutKey, string> = {
    grid: 'Affichage grille',
    list: 'Affichage liste'
  };
  const themeLabels: Record<ThemeKey, string> = {
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre'
  };

  const sizeOptions: TextSizeKey[] = ['small', 'medium', 'large'];
  const sortOptions: SortKey[] = ['updated', 'created', 'title'];
  const layoutOptions: LayoutKey[] = ['grid', 'list'];
  const themeOptions: ThemeKey[] = ['system', 'light', 'dark'];

  function exportNotes() {
    const payload = {
      app: 'notes',
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: notesStore.folders,
      notes: notesStore.notes,
      tasks: notesStore.taskList
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.show('Export JSON téléchargé');
  }

  async function loadTestDatabase() {
    const ok = await confirmStore.ask(
      'Base de test',
      'Remplacer vos données par la base de test (notes, dossiers, tâches) ?',
      'Charger'
    );
    if (!ok) return;
    await notesStore.purgeEverything();
    notesStore.folders = [];
    notesStore.taskList = [];
    const result = await notesStore.importPayload(TEST_PAYLOAD);
    toast.show(`Base de test chargée (${result.notes} notes)`);
  }

  async function importNotes(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const result = await notesStore.importPayload(payload);
      const parts = [
        `${result.notes} note${result.notes > 1 ? 's' : ''}`,
        `${result.folders} dossier${result.folders > 1 ? 's' : ''}`,
        `${result.tasks} tâche${result.tasks > 1 ? 's' : ''}`
      ];
      toast.show(`Importé : ${parts.join(', ')}`);
    } catch (error) {
      console.error('Import impossible', error);
      toast.show('Fichier JSON invalide');
    } finally {
      input.value = '';
    }
  }
</script>

<div class="settings">
  <header class="settings-head" class:compact={scrolled}>
    <button class="icon-btn" onclick={onclose} aria-label="Retour">
      <Icon name="back" size={24} />
    </button>
    <span class="compact-title">Notes</span>
  </header>

  <div
    class="settings-scroll"
    onscroll={(event) => (scrolled = event.currentTarget.scrollTop > 40)}
  >
    <h1 class="screen-title">Notes</h1>

    <div class="section">Services Cloud</div>
    <button class="row" onclick={() => (sheet = 'cloud')}>
      <span class="label">Xiaomi Cloud</span>
      <span class="value">Bientôt disponible</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <button
      class="row disabled"
      onclick={() => toast.show('Aucune donnée dans le cloud')}
    >
      <span class="label">Supprimer les notes dans le cloud</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>

    <div class="divider"></div>
    <div class="section">Style</div>
    <button class="row" onclick={() => (sheet = 'size')}>
      <span class="label">Taille du texte</span>
      <span class="value">{sizeLabels[notesStore.textSize]}</span>
      <Icon name="updown" size={19} class="chev" />
    </button>
    <button class="row" onclick={() => (sheet = 'sort')}>
      <span class="label">Trier</span>
      <span class="value">{sortLabels[notesStore.sort]}</span>
      <Icon name="updown" size={19} class="chev" />
    </button>
    <button class="row" onclick={() => (sheet = 'layout')}>
      <span class="label">Disposition</span>
      <span class="value">{layoutLabels[notesStore.layout]}</span>
      <Icon name="updown" size={19} class="chev" />
    </button>

    <div class="divider"></div>
    <div class="section">Fonctionnalités rapides</div>
    <button class="row" onclick={() => (sheet = 'quick')}>
      <span class="label">Notes rapides</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>

    <div class="divider"></div>
    <div class="section">Rappels</div>
    <div class="row">
      <div class="row-text">
        <span class="label">Rappels de haute priorité</span>
        <span class="sub">Jouez du son même lorsque le mode Silencieux ou NPD est activé</span>
      </div>
      <button
        class="switch"
        class:on={notesStore.highPriorityReminders}
        onclick={() => notesStore.setHighPriorityReminders(!notesStore.highPriorityReminders)}
        aria-label="Rappels de haute priorité"
        aria-pressed={notesStore.highPriorityReminders}
      ></button>
    </div>

    <div class="divider"></div>
    <div class="section upper">AUTRE</div>
    <button class="row" onclick={() => (sheet = 'privacy')}>
      <span class="label">Politique de Confidentialité</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <button class="row" onclick={ontrash}>
      <span class="label">Corbeille</span>
      <span class="value">{notesStore.trash.length || ''}</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <div class="row">
      <div class="row-text">
        <span class="label">Afficher les notes masquées</span>
        <span class="sub">
          {notesStore.hiddenCount} note{notesStore.hiddenCount > 1 ? 's' : ''} masquée{notesStore.hiddenCount > 1 ? 's' : ''}
        </span>
      </div>
      <button
        class="switch"
        class:on={notesStore.showHidden}
        onclick={() => notesStore.setShowHidden(!notesStore.showHidden)}
        aria-label="Afficher les notes masquées"
        aria-pressed={notesStore.showHidden}
      ></button>
    </div>
    <button class="row" onclick={() => (sheet = 'theme')}>
      <span class="label">Thème</span>
      <span class="value">{themeLabels[notesStore.theme]}</span>
      <Icon name="updown" size={19} class="chev" />
    </button>
    <button class="row" onclick={exportNotes}>
      <span class="label">Exporter les notes</span>
      <span class="value">JSON</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <button class="row" onclick={() => fileInput?.click()}>
      <span class="label">Importer des notes</span>
      <span class="value">JSON</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <input
      bind:this={fileInput}
      class="file-input"
      type="file"
      accept="application/json,.json"
      onchange={importNotes}
    />
    {#if devMode}
      <button class="row" onclick={loadTestDatabase}>
        <span class="label">Charger la base de test</span>
        <span class="value">dev</span>
        <Icon name="chevron-right" size={20} class="chev" />
      </button>
    {/if}
    <div class="row plain">
      <span class="label">Version</span>
      <span class="value">{appVersion}</span>
    </div>
  </div>

  <Sheet
    open={sheet !== null}
    onclose={() => (sheet = null)}
    title={sheet === 'size'
      ? 'Taille du texte'
      : sheet === 'sort'
        ? 'Trier'
        : sheet === 'layout'
          ? 'Disposition'
          : sheet === 'theme'
            ? 'Thème'
            : sheet === 'quick'
              ? 'Notes rapides'
              : sheet === 'privacy'
                ? 'Politique de Confidentialité'
                : 'Xiaomi Cloud'}
  >
    {#if sheet === 'size'}
      {#each sizeOptions as option (option)}
        <button class="sheet-row" onclick={() => { notesStore.setTextSize(option); sheet = null; }}>
          <span class="grow">{sizeLabels[option]}</span>
          {#if notesStore.textSize === option}<Icon name="check" size={20} class="check" />{/if}
        </button>
      {/each}
    {:else if sheet === 'sort'}
      {#each sortOptions as option (option)}
        <button class="sheet-row" onclick={() => { notesStore.setSort(option); sheet = null; }}>
          <span class="grow">{sortLabels[option]}</span>
          {#if notesStore.sort === option}<Icon name="check" size={20} class="check" />{/if}
        </button>
      {/each}
    {:else if sheet === 'layout'}
      {#each layoutOptions as option (option)}
        <button class="sheet-row" onclick={() => { notesStore.setLayout(option); sheet = null; }}>
          <span class="grow">{layoutLabels[option]}</span>
          {#if notesStore.layout === option}<Icon name="check" size={20} class="check" />{/if}
        </button>
      {/each}
    {:else if sheet === 'theme'}
      {#each themeOptions as option (option)}
        <button class="sheet-row" onclick={() => { notesStore.setTheme(option); sheet = null; }}>
          <span class="grow">{themeLabels[option]}</span>
          {#if notesStore.theme === option}<Icon name="check" size={20} class="check" />{/if}
        </button>
      {/each}
    {:else if sheet === 'quick'}
      <div class="text-block">
        <p>Créez une note en un geste depuis l’écran d’accueil ou l’écran verrouillé.</p>
      </div>
      <div class="row">
        <span class="label grow">Activer les notes rapides</span>
        <button
          class="switch"
          class:on={notesStore.quickNotes}
          onclick={() => notesStore.setQuickNotes(!notesStore.quickNotes)}
          aria-label="Activer les notes rapides"
          aria-pressed={notesStore.quickNotes}
        ></button>
      </div>
    {:else if sheet === 'privacy'}
      <div class="text-block">
        <p>
          Vos notes sont stockées uniquement sur cet appareil (IndexedDB). Aucune donnée n’est
          envoyée à un serveur, aucun compte n’est requis, aucun traqueur n’est chargé.
        </p>
        <p class="hint">
          La future synchronisation sera auto-hébergée : vous choisirez votre propre serveur.
        </p>
      </div>
    {:else if sheet === 'cloud'}
      <div class="text-block">
        <p>
          La synchronisation auto-hébergée arrive dans une prochaine version : un petit serveur à
          vous, compatible téléphone et ordinateur, sans compte chez un tiers.
        </p>
        <p class="hint">En attendant, vos notes restent uniquement sur cet appareil.</p>
      </div>
    {/if}
  </Sheet>
</div>

<style>
  .settings {
    height: var(--app-height, 100dvh);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .settings-head {
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
    padding: calc(var(--safe-top) + 2px) 10px 0 8px;
    min-height: calc(var(--safe-top) + 46px);
    background: var(--bg);
  }

  .compact-title {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 19px;
    font-weight: 500;
    letter-spacing: -0.2px;
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
  }

  .settings-head.compact .compact-title {
    opacity: 1;
  }

  .settings-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(40px + var(--safe-bottom));
  }

  .settings-scroll .screen-title {
    padding-top: 26px;
    padding-bottom: 6px;
  }

  .section {
    padding: 26px 26px 10px;
    font-size: 15px;
    color: var(--text-3);
  }

  .section.upper {
    letter-spacing: 0.05em;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 15px 26px;
    text-align: left;
    color: var(--text);
  }

  .row:active .label {
    opacity: 0.7;
  }

  .row.disabled {
    opacity: 0.45;
  }

  .row .label {
    font-size: 17.5px;
    font-weight: 600;
    letter-spacing: -0.1px;
  }

  .row .grow {
    flex: 1;
  }

  .row .value {
    margin-left: auto;
    font-size: 15px;
    line-height: 1.25;
    color: var(--text-3);
    text-align: right;
    max-width: 52%;
  }

  :global(.chev) {
    color: var(--text-3);
    flex: 0 0 auto;
  }

  .file-input {
    display: none;
  }

  .divider {
    height: 1px;
    margin: 8px 26px;
    background: var(--line);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 78%;
  }

  .sub {
    font-size: 14px;
    line-height: 1.35;
    color: var(--text-3);
  }

  .switch {
    margin-left: auto;
  }

  .plain {
    color: var(--text);
  }

  :global(.check) {
    color: var(--accent);
  }

  .text-block {
    padding: 6px 22px 18px;
    color: var(--text-2);
    font-size: 15px;
    line-height: 1.55;
  }

  .text-block p {
    margin: 0 0 12px;
  }

  .hint {
    color: var(--text-3);
    font-size: 14px;
  }
</style>
