<script lang="ts">
const ICONS: Record<string, string> = {
  back: '<path d="M14.6 4.8 7.4 12l7.2 7.2"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="12" cy="4.9" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19.1" r="1.7"/></g>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>',
  check: '<path d="M4.6 12.6 9 17 19.4 6.6"/>',
  pin: '<path d="M9.2 3.6h5.6l-.9 5.4 3.3 3.4H6.8l3.3-3.4-.9-5.4Z"/><path d="M12 12.4V20"/>',
  'pin-filled':
    '<path d="M9.2 3.6h5.6l-.9 5.4 3.3 3.4H6.8l3.3-3.4-.9-5.4Z" fill="currentColor"/><path d="M12 12.4V20"/>',
  palette:
    '<g fill="currentColor" stroke="none"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4 11 4.67 11 5.5 10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4 16 4.67 16 5.5 15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8 19 8.67 19 9.5 18.33 11 17.5 11z"/></g>',
  trash:
    '<path d="M4.5 7h15M9.5 7V5.2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1V7M6.6 7l.8 12.2c0 .6.5 1 1.1 1h7c.6 0 1.1-.4 1.1-1L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/>',
  restore: '<path d="M4.6 9.4a8 8 0 1 1 .6 4.6"/><path d="M3.8 4.8v4.8h4.8"/>',
  copy: '<rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.2"/><path d="M15.6 8.4V6.2c0-1-.8-1.8-1.8-1.8H5.8C4.8 4.4 4 5.2 4 6.2v8c0 1 .8 1.8 1.8 1.8h2.6"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.8h.01"/>',
  note: '<rect x="5.2" y="3.4" width="13.6" height="17.2" rx="2.6"/><path d="M8.6 8h6.8M8.6 12h6.8M8.6 16h4"/>',
  'note-filled':
    '<rect x="4.8" y="2.8" width="14.4" height="18.4" rx="3.2" fill="currentColor" stroke="none"/><path d="M8.4 8.2h7.2M8.4 12h7.2M8.4 16h4.4" stroke="var(--bg)" stroke-width="1.6"/>',
  'check-square-filled':
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6" fill="currentColor" stroke="none"/><path d="M7.8 12.2l2.9 2.9 5.5-6" stroke="var(--bg)" stroke-width="2.1"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="M16.1 16.1 20.5 20.5"/>',
  folder:
    '<path d="M3.6 7.2c0-1 .8-1.8 1.8-1.8h3.3l2 2.2h7.9c1 0 1.8.8 1.8 1.8v8.8c0 1-.8 1.8-1.8 1.8H5.4c-1 0-1.8-.8-1.8-1.8V7.2Z"/>',
  'folder-move':
    '<path d="M3.6 7.2c0-1 .8-1.8 1.8-1.8h3.3l2 2.2h7.9c1 0 1.8.8 1.8 1.8v8.8c0 1-.8 1.8-1.8 1.8H5.4c-1 0-1.8-.8-1.8-1.8V7.2Z"/><path d="M9.6 13.2h5.2M12.8 11l2.2 2.2-2.2 2.2" stroke-width="1.6"/>',
  lock: '<rect x="4.8" y="10.2" width="14.4" height="10.2" rx="2.6"/><path d="M8.4 10.2V7.6a3.6 3.6 0 0 1 7.2 0v2.6"/>',
  'select-all':
    '<path d="M9 6.4h11M9 12h11M9 17.6h11"/><path d="M4.2 5.4l1.3 1.3 2.2-2.4M4.2 16.6l1.3 1.3 2.2-2.4"/>',
  gear: '<circle cx="12" cy="12" r="3.3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  share: '<path d="M12 3.6v10.8"/><path d="M8 7.6l4-4 4 4"/><path d="M5.6 13.4v5.2a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2v-5.2"/>',
  tshirt:
    '<path d="M8.6 3.6 4 6.3l1.7 3.5 2.4-1V20h7.8V8.8l2.4 1L20 6.3l-4.6-2.7a3.4 3.4 0 0 1-6.8 0Z"/>',
  undo: '<path d="M9 14 4.4 9.4 9 4.8"/><path d="M4.6 9.4h9.6a5.6 5.6 0 0 1 0 11.2H10"/>',
  redo: '<path d="M15 14l4.6-4.6L15 4.8"/><path d="M19.4 9.4H9.8a5.6 5.6 0 0 0 0 11.2H14"/>',
  waveform: '<path d="M4 10v4M8 6.6v10.8M12 8.8v6.4M16 4.6v14.8M20 9.2v5.6"/>',
  draw: '<path d="M3.4 15.6c2.4-6.2 4.4-8.4 5.9-7s-.9 6.6 1.1 7.2 3.9-4.2 6.3-6.7 3.7-2 3.1.2-2 3.1-.9 4.1"/>',
  t: '<path d="M5.6 5.4h12.8M12 5.4v13.2M9.4 18.6h5.2"/>',
  cloud:
    '<path d="M7.4 18.4h9.9a3.8 3.8 0 0 0 .4-7.6 5.7 5.7 0 0 0-11-1.7 4.7 4.7 0 0 0 .7 9.3Z"/>',
  bell: '<path d="M6.4 16.4V11a5.6 5.6 0 0 1 11.2 0v5.4l1.6 2.2H4.8l1.6-2.2Z"/><path d="M10.2 21a2 2 0 0 0 3.6 0"/>',
  'chevron-right': '<path d="M9.4 5.6 15.8 12l-6.4 6.4"/>',
  updown: '<path d="M8.4 9.4 12 5.8l3.6 3.6M8.4 14.6 12 18.2l3.6-3.6"/>',
  'check-square':
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.4"/><path d="M8 12.2l2.8 2.8 5.4-5.8"/>',
  highlighter:
    '<path d="M9.4 6.6l8 8-3.9 3.9-8-8a1.6 1.6 0 0 1 0-2.3l.6-.6a1.6 1.6 0 0 1 2.3 0Z"/><path d="M8.6 15.4 4.9 19l-1 .1.1-1 3.6-3.7"/>',
  'list-bullet':
    '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><g fill="currentColor" stroke="none"><circle cx="4.6" cy="6.5" r="1.4"/><circle cx="4.6" cy="12" r="1.4"/><circle cx="4.6" cy="17.5" r="1.4"/></g>',
  'list-number':
    '<path d="M9.4 6.5h10.6M9.4 12H20M9.4 17.5H20"/><g fill="currentColor" stroke="none" font-size="7.5" font-weight="600"><text x="3" y="8.9">1</text><text x="3" y="14.4">2</text><text x="3" y="19.9">3</text></g>',
  'clear-format':
    '<path d="M4.6 5.4h9.2M9.2 5.4 7.2 18.4M4.4 18.4h6"/><path d="M14.6 11.6l4.8 4.8M19.4 11.6l-4.8 4.8"/>',
  image:
    '<rect x="3.5" y="4.8" width="17" height="14.4" rx="2.4"/><circle cx="8.6" cy="9.8" r="1.5"/><path d="M4.4 17.1l4.1-4.2 3 3 2.6-2.5 4.8 4.6"/>',
  checklist:
    '<rect x="3.8" y="4.4" width="5.2" height="5.2" rx="1.4"/><path d="M5.2 7l1.2 1.2 2-2.2"/><rect x="3.8" y="14.4" width="5.2" height="5.2" rx="1.4"/><path d="M12.6 7h7.6M12.6 17h7.6"/>',
  text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M4.1 4.1l1.5 1.5M18.4 18.4l1.5 1.5M2.6 12h2M19.4 12h2M4.1 19.9l1.5-1.5M18.4 5.6l1.5-1.5"/>',
  monitor:
    '<rect x="3.4" y="4.6" width="17.2" height="12" rx="2"/><path d="M9 20h6M12 16.6V20"/>'
};

interface Props {
  name: string;
  size?: number;
  stroke?: number;
  class?: string;
}

let { name, size = 24, stroke = 1.7, class: className = '' }: Props = $props();
const markup = $derived(ICONS[name] ?? '');
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {@html markup}
</svg>
