<script lang="ts">
  import { toast } from '../toast.svelte';
</script>

{#if toast.visible}
  <div class="toast" role="status">{toast.message}</div>
{/if}
