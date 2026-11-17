<script lang="ts">
  import { onMount } from 'svelte';
  import HomeScreen from './lib/components/HomeScreen.svelte';
  import EditorScreen from './lib/components/EditorScreen.svelte';
  import SettingsScreen from './lib/components/SettingsScreen.svelte';
  import TrashScreen from './lib/components/TrashScreen.svelte';
  import FoldersScreen from './lib/components/FoldersScreen.svelte';
  import Toast from './lib/components/Toast.svelte';
  import ConfirmDialog from './lib/components/ConfirmDialog.svelte';
  import { notesStore } from './lib/notes.svelte';
  import { startReminderWatcher } from './lib/reminders';
  import { syncStore } from './lib/sync.svelte';
  import { completeLogin, readConfig } from './lib/cloud/oidc';

  type Screen = 'home' | 'note' | 'settings' | 'trash' | 'folders';

  let screen = $state<Screen>('home');
  let homeTab = $state<'notes' | 'tasks'>('notes');
  let noteId = $state<string | null>(null);

  const current = $derived(
    noteId ? (notesStore.notes.find((n) => n.id === noteId) ?? null) : null
  );

  $effect(() => {
    notesStore.applyTheme();
  });

  $effect(() => {
    notesStore.applyPrefs();
  });

  $effect(() => {
    if (screen === 'note' && !current) {
      screen = 'home';
      noteId = null;
    }
  });

  onMount(() => {
    void (async () => {
      // Retour de Keycloak : on échange le code avant tout le reste.
      const config = readConfig();
      if (config && new URLSearchParams(location.search).has('code')) {
        try {
          await completeLogin(config);
        } catch (error) {
          console.error('Connexion OIDC impossible', error);
        }
      }

      await notesStore.init();
      startReminderWatcher();
      syncStore.start();
    })();

    const onPop = () => {
      if (screen !== 'home') {
        screen = 'home';
        noteId = null;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  function push(screenName: Screen) {
    screen = screenName;
    history.pushState({ screen: screenName }, '');
  }

  function openNote(id: string) {
    noteId = id;
    push('note');
  }

  function createNote() {
    const note = notesStore.create();
    openNote(note.id);
  }

  function openSettings() {
    push('settings');
  }

  function openFolders() {
    push('folders');
  }

  function openTrash() {
    push('trash');
  }

  function goHome() {
    if (history.state?.screen) {
      history.back();
    } else {
      screen = 'home';
      noteId = null;
    }
  }

  function switchTab(tab: 'notes' | 'tasks') {
    homeTab = tab;
    notesStore.activeCategory = 'all';
  }
</script>

<div class="app">
  {#if screen === 'note' && current}
    {#key current.id}
      <EditorScreen note={current} onclose={goHome} />
    {/key}
  {:else if screen === 'settings'}
    <SettingsScreen onclose={goHome} ontrash={openTrash} />
  {:else if screen === 'trash'}
    <TrashScreen onclose={goHome} />
  {:else if screen === 'folders'}
    <FoldersScreen onclose={goHome} ontrash={openTrash} />
  {:else}
    <HomeScreen
      tab={homeTab}
      ontab={switchTab}
      onopen={openNote}
      onnew={createNote}
      onsettings={openSettings}
      onfolders={openFolders}
    />
  {/if}

  <Toast />
  <ConfirmDialog />
</div>
