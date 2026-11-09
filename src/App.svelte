<script lang="ts">
  import { onMount } from 'svelte';
  import HomeScreen from './lib/components/HomeScreen.svelte';
  import EditorScreen from './lib/components/EditorScreen.svelte';
  import TrashScreen from './lib/components/TrashScreen.svelte';
  import { notesStore } from './lib/notes.svelte';
  import type { NoteKind } from './lib/types';

  type View = 'home' | 'editor' | 'trash';

  let view = $state<View>('home');
  let editingId = $state<string | null>(null);

  const current = $derived(
    editingId ? (notesStore.notes.find((n) => n.id === editingId) ?? null) : null
  );

  $effect(() => {
    notesStore.applyTheme();
  });

  $effect(() => {
    if (view === 'editor' && !current) {
      view = 'home';
      editingId = null;
    }
  });

  onMount(() => {
    void notesStore.init();

    const onPop = () => {
      if (view === 'editor' || view === 'trash') {
        view = 'home';
        editingId = null;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  function openNote(id: string) {
    editingId = id;
    view = 'editor';
    history.pushState({ screen: 'editor' }, '');
  }

  function createNote(kind: NoteKind) {
    const note = notesStore.create(kind);
    openNote(note.id);
  }

  function openTrash() {
    view = 'trash';
    history.pushState({ screen: 'trash' }, '');
  }

  function goHome() {
    if (history.state?.screen) {
      history.back();
    } else {
      view = 'home';
      editingId = null;
    }
  }
</script>

<div class="app">
  {#if view === 'editor' && current}
    {#key current.id}
      <EditorScreen note={current} onclose={goHome} />
    {/key}
  {:else if view === 'trash'}
    <TrashScreen onclose={goHome} />
  {:else}
    <HomeScreen onopen={openNote} onnew={createNote} ontrash={openTrash} />
  {/if}
</div>
