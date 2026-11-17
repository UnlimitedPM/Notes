import { notesStore } from './notes.svelte';
import { toast } from './toast.svelte';

let timer: ReturnType<typeof setInterval> | undefined;
let started = false;

/**
 * Vérifie les rappels arrivés à échéance pendant que l'app est ouverte.
 * Sans serveur on ne peut pas réveiller l'app : le rappel part à l'ouverture
 * ou pendant l'utilisation. (Les rappels système viendront avec le push.)
 */
function check(): void {
  const due = notesStore.dueReminders();
  for (const note of due) {
    notesStore.setReminder(note.id, null);
    const label = note.title.trim() || 'Note sans titre';
    toast.show(`Rappel : ${label}`);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Rappel', { body: label, tag: note.id });
      }
    } catch {
      /* notification indisponible */
    }
  }
}

export function startReminderWatcher(): void {
  if (started) return;
  started = true;
  check();
  timer = setInterval(check, 20_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

export function stopReminderWatcher(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
  started = false;
}

/** Demande la permission d'afficher des notifications (une seule fois, sur geste). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}
