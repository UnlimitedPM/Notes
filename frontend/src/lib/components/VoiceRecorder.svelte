<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    onclose: () => void;
    ondone: (dataUrl: string, mime: string) => void;
  }

  let { onclose, ondone }: Props = $props();

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let phase = $state<'idle' | 'recording' | 'error'>('idle');
  let seconds = $state(0);
  let message = $state('');
  let ticker: ReturnType<typeof setInterval> | undefined;

  async function startRecording() {
    message = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') ondone(reader.result, blob.type);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      phase = 'recording';
      seconds = 0;
      ticker = setInterval(() => {
        seconds += 1;
      }, 1000);
    } catch (error) {
      console.error('Micro indisponible', error);
      phase = 'error';
      message = 'Micro refusé ou indisponible. Autorisez le microphone dans le navigateur.';
    }
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = undefined;
  }

  function stop() {
    stopTicker();
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    phase = 'idle';
  }

  function cancel() {
    stopTicker();
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    onclose();
  }

  function formatDuration(total: number): string {
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  $effect(() => () => {
    stopTicker();
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
  });
</script>

<div class="rec" role="dialog" aria-modal="true" aria-label="Note vocale">
  <div class="box">
    <div class="mic" class:live={phase === 'recording'}>
      <Icon name="waveform" size={40} />
    </div>
    <div class="timer">{formatDuration(seconds)}</div>
    <p class="hint">
      {#if message}
        {message}
      {:else if phase === 'recording'}
        Enregistrement en cours…
      {:else}
        Appuyez sur le micro pour enregistrer
      {/if}
    </p>
    <div class="actions">
      <button class="ghost" onclick={cancel}>Annuler</button>
      {#if phase === 'recording'}
        <button class="stop" onclick={stop} aria-label="Arrêter et insérer">
          <span></span>
        </button>
      {:else}
        <button class="start" onclick={startRecording} aria-label="Démarrer l'enregistrement">
          <Icon name="waveform" size={22} />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .rec {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.55);
    padding: 24px;
  }

  .box {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 26px 20px 18px;
    border-radius: 24px;
    background: var(--surface);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  }

  .mic {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-2);
  }

  .mic.live {
    background: var(--accent);
    color: var(--on-accent);
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.06);
    }
  }

  .timer {
    font-size: 30px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.35;
    text-align: center;
    color: var(--text-3);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 6px;
  }

  .ghost {
    padding: 12px 18px;
    border-radius: 14px;
    font-size: 16px;
    color: var(--text-2);
  }

  .start {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
  }

  .stop {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--danger);
  }

  .stop span {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: #fff;
  }
</style>
