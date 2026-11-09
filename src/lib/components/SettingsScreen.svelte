<script lang="ts">
  import Icon from './Icon.svelte';
  import Sheet from './Sheet.svelte';
  import { notesStore } from '../notes.svelte';
  import type { LayoutKey, SortKey, TextSizeKey, ThemeKey } from '../types';
  import { toast } from '../toast.svelte';

  type SheetName = 'size' | 'sort' | 'layout' | 'theme' | 'cloud' | null;

  interface Props {
    onclose: () => void;
    ontrash: () => void;
  }

  let { onclose, ontrash }: Props = $props();

  let sheet = $state<SheetName>(null);

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
      notes: notesStore.notes
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
</script>

<div class="settings">
  <header class="settings-head">
    <button class="icon-btn" onclick={onclose} aria-label="Retour">
      <Icon name="back" size={25} />
    </button>
  </header>

  <div class="settings-scroll">
    <h1 class="screen-title">Notes</h1>

    <div class="section">Services Cloud</div>
    <button class="row" onclick={() => (sheet = 'cloud')}>
      <span class="label">Cloud personnel</span>
      <span class="value">Bientôt disponible</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <div class="row disabled">
      <span class="label">Supprimer les notes du cloud</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </div>

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
    <div class="row">
      <span class="label grow">Notes rapides</span>
      <button
        class="switch"
        class:on={notesStore.quickNotes}
        onclick={() => notesStore.setQuickNotes(!notesStore.quickNotes)}
        aria-label="Notes rapides"
        aria-pressed={notesStore.quickNotes}
      ></button>
    </div>

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
    <div class="section">Apparence</div>
    <button class="row" onclick={() => (sheet = 'theme')}>
      <span class="label">Thème</span>
      <span class="value">{themeLabels[notesStore.theme]}</span>
      <Icon name="updown" size={19} class="chev" />
    </button>

    <div class="divider"></div>
    <div class="section">Données</div>
    <button class="row" onclick={ontrash}>
      <span class="label">Corbeille</span>
      <span class="value">{notesStore.trash.length || ''}</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>
    <button class="row" onclick={exportNotes}>
      <span class="label">Exporter les notes</span>
      <span class="value">JSON</span>
      <Icon name="chevron-right" size={20} class="chev" />
    </button>

    <div class="divider"></div>
    <div class="row plain">
      <span class="label">Version</span>
      <span class="value">0.2.0</span>
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
            : 'Cloud personnel'}
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
    {:else if sheet === 'cloud'}
      <div class="cloud-note">
        <p>
          La synchronisation auto-hébergée arrive dans une prochaine version : un petit serveur
          à vous, compatible téléphone et ordinateur, sans compte chez un tiers.
        </p>
        <p class="cloud-hint">
          En attendant, vos notes restent uniquement sur cet appareil (stockage local).
        </p>
      </div>
    {/if}
  </Sheet>
</div>

<style>
  .settings {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .settings-head {
    display: flex;
    align-items: center;
    padding: calc(var(--safe-top) + 4px) 8px 0;
  }

  .settings-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(40px + var(--safe-bottom));
  }

  .settings-scroll .screen-title {
    padding-top: 18px;
    padding-bottom: 8px;
  }

  .section {
    padding: 26px 20px 10px;
    font-size: 14.5px;
    color: var(--text-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 16px 20px;
    text-align: left;
    color: var(--text);
  }

  .row:active .label {
    opacity: 0.7;
  }

  .row.disabled {
    opacity: 0.4;
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
    color: var(--text-3);
    text-align: right;
    max-width: 55%;
  }

  .row .label + .value {
    padding-left: 12px;
  }

  :global(.chev) {
    color: var(--text-3);
    flex: 0 0 auto;
  }

  .divider {
    height: 1px;
    margin: 6px 20px;
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

  .cloud-note {
    padding: 8px 20px 18px;
    color: var(--text-2);
    font-size: 15px;
    line-height: 1.55;
  }

  .cloud-note p {
    margin: 0 0 12px;
  }

  .cloud-hint {
    color: var(--text-3);
    font-size: 14px;
  }
</style>
