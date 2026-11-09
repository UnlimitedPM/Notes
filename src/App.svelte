<script lang="ts">
  import { onMount } from 'svelte';
  import HomeScreen from './lib/components/HomeScreen.svelte';
  import EditorScreen from './lib/components/EditorScreen.svelte';
  import SettingsScreen from './lib/components/SettingsScreen.svelte';
  import TrashScreen from './lib/components/TrashScreen.svelte';
  import Toast from './lib/components/Toast.svelte';
  import ConfirmDialog from './lib/components/ConfirmDialog.svelte';
  import { notesStore } from './lib/notes.svelte';

  type Screen = 'home' | 'note' | 'settings' | 'trash';

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
    void notesStore.init();

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
    const note =
      homeTab === 'tasks' ? notesStore.create('checklist') : notesStore.create('text');
    openNote(note.id);
  }

  function openSettings() {
    push('settings');
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
    notesStore.activeFolderId = null;
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
  {:else}
    <HomeScreen
      tab={homeTab}
      ontab={switchTab}
      onopen={openNote}
      onnew={createNote}
      onsettings={openSettings}
    />
  {/if}

  <Toast />
  <ConfirmDialog />
</div>
