<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    onclose: () => void;
    ondone: (dataUrl: string) => void;
  }

  let { onclose, ondone }: Props = $props();

  const viewportWidth = typeof window === 'undefined' ? 360 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 700 : window.innerHeight;
  const width = Math.max(240, Math.min(380, viewportWidth - 32));
  const height = Math.max(220, Math.min(460, viewportHeight - 230));

  let canvas = $state<HTMLCanvasElement | null>(null);
  let color = $state('#ffffff');
  let size = $state(4);
  let erasing = $state(false);
  let drawing = $state(false);
  let hasContent = $state(false);

  const colors = ['#ffffff', '#ffb300', '#ff5d5d', '#59d102', '#4aa8ff', '#c07bff'];

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(width * ratio);
    el.height = Math.round(height * ratio);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, width, height);
  });

  function pos(event: PointerEvent): { x: number; y: number } {
    const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: PointerEvent) {
    const el = canvas;
    if (!el) return;
    el.setPointerCapture(event.pointerId);
    drawing = true;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const point = pos(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.1, point.y + 0.1);
    ctx.strokeStyle = erasing ? '#1c1c1e' : color;
    ctx.lineWidth = erasing ? size * 3 : size;
    ctx.stroke();
    hasContent = true;
  }

  function move(event: PointerEvent) {
    if (!drawing) return;
    const el = canvas;
    const ctx = el?.getContext('2d');
    if (!ctx) return;
    const point = pos(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function end() {
    drawing = false;
  }

  function clear() {
    const el = canvas;
    const ctx = el?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, width, height);
    hasContent = false;
  }

  function insert() {
    const el = canvas;
    if (!el) return;
    ondone(el.toDataURL('image/png'));
  }
</script>

<div class="pad" role="dialog" aria-modal="true" aria-label="Dessin">
  <div class="pad-bar">
    <button class="icon-btn" onclick={onclose} aria-label="Fermer le dessin">
      <Icon name="close" size={22} />
    </button>
    <span class="pad-title">Croquis</span>
    <button class="text-btn" onclick={clear}>Effacer</button>
  </div>

  <canvas
    bind:this={canvas}
    style="width:{width}px;height:{height}px"
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
  ></canvas>

  <div class="pad-tools">
    <div class="swatches">
      {#each colors as tone (tone)}
        <button
          class="tone"
          class:on={!erasing && color === tone}
          style="--tone:{tone}"
          onclick={() => {
            color = tone;
            erasing = false;
          }}
          aria-label={`Couleur ${tone}`}
        ></button>
      {/each}
      <button
        class="eraser"
        class:on={erasing}
        onclick={() => (erasing = true)}
        aria-label="Gomme"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
    <div class="sizes">
      {#each [2, 4, 8] as thickness (thickness)}
        <button
          class="thick"
          class:on={size === thickness}
          onclick={() => (size = thickness)}
          aria-label={`Trait ${thickness}`}
        >
          <span style="width:{thickness + 2}px;height:{thickness + 2}px"></span>
        </button>
      {/each}
    </div>
    <button class="insert" onclick={insert} disabled={!hasContent}>Insérer</button>
  </div>
</div>

<style>
  .pad {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    background: var(--bg);
  }

  .pad-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 460px;
  }

  .pad-title {
    flex: 1;
    font-size: 17px;
    font-weight: 500;
  }

  .text-btn {
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 15px;
    color: var(--accent);
  }

  canvas {
    touch-action: none;
    border-radius: 16px;
    background: #1c1c1e;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    max-width: 100%;
  }

  .pad-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 460px;
    flex-wrap: wrap;
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tone {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--tone);
    border: 2px solid transparent;
  }

  .tone.on {
    border-color: var(--text);
  }

  .eraser {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 2px solid var(--line);
    color: var(--text-2);
  }

  .eraser.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .sizes {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .thick {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--surface-2);
  }

  .thick span {
    display: block;
    border-radius: 50%;
    background: var(--text);
  }

  .thick.on {
    outline: 2px solid var(--accent);
  }

  .insert {
    height: 42px;
    padding: 0 20px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 16px;
    font-weight: 600;
  }

  .insert:disabled {
    opacity: 0.4;
  }
</style>
