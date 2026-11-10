<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    tab: 'notes' | 'tasks';
    ontab: (tab: 'notes' | 'tasks') => void;
  }

  let { tab, ontab }: Props = $props();
</script>

<nav class="tabbar" aria-label="Navigation principale">
  <button
    class="tab"
    class:active={tab === 'notes'}
    onclick={() => ontab('notes')}
    aria-current={tab === 'notes' ? 'page' : undefined}
  >
    <Icon name="note-filled" size={22} />
    <span>Notes</span>
  </button>
  <button
    class="tab"
    class:active={tab === 'tasks'}
    onclick={() => ontab('tasks')}
    aria-current={tab === 'tasks' ? 'page' : undefined}
  >
    <Icon name="check-square-filled" size={22} />
    <span>Tâches</span>
  </button>
</nav>

<style>
  .tabbar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 15;
    display: flex;
    height: calc(70px + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--bg);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--text-3);
    font-size: 12.5px;
    font-weight: 500;
    transition: color 0.15s ease;
  }

  .tab.active {
    color: var(--text);
  }
</style>
