<script lang="ts">
const ICONS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="6.6"/><path d="M16.1 16.1 20.5 20.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M14.5 4.8 7.3 12l7.2 7.2"/>',
  close: '<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="12" cy="4.9" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19.1" r="1.7"/></g>',
  check: '<path d="M5 12.7l4.4 4.4L19 7.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>',
  pin: '<path d="M9.2 3.6h5.6l-.9 5.4 3.3 3.4H6.8l3.3-3.4-.9-5.4Z"/><path d="M12 12.4V20"/>',
  'pin-filled':
    '<path d="M9.2 3.6h5.6l-.9 5.4 3.3 3.4H6.8l3.3-3.4-.9-5.4Z" fill="currentColor"/><path d="M12 12.4V20"/>',
  palette:
    '<g fill="currentColor" stroke="none"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4 11 4.67 11 5.5 10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4 16 4.67 16 5.5 15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8 19 8.67 19 9.5 18.33 11 17.5 11z"/></g>',
  trash:
    '<path d="M4.5 7h15M9.5 7V5.2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1V7M6.6 7l.8 12.2c0 .6.5 1 1.1 1h7c.6 0 1.1-.4 1.1-1L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/>',
  checklist:
    '<rect x="3.6" y="4.6" width="5.2" height="5.2" rx="1.2"/><path d="M5 7.2l1.2 1.2 2-2.2"/><rect x="3.6" y="14.2" width="5.2" height="5.2" rx="1.2"/><path d="M12.4 7.2h8M12.4 16.8h8"/>',
  text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  image:
    '<rect x="3.5" y="4.8" width="17" height="14.4" rx="2.4"/><circle cx="8.6" cy="9.8" r="1.5"/><path d="M4.4 17.1l4.1-4.2 3 3 2.6-2.5 4.8 4.6"/>',
  mic: '<rect x="9.2" y="3.4" width="5.6" height="10.2" rx="2.8"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8V21"/>',
  pen: '<path d="M4.2 19.8l.9-3.6L15.7 5.6a1.8 1.8 0 0 1 2.6 0l.1.1a1.8 1.8 0 0 1 0 2.6L7.8 18.9l-3.6.9Z"/><path d="M14.4 7l2.6 2.6"/>',
  tag: '<path d="M12.6 3.6H20v7.4l-8.8 8.8a1.4 1.4 0 0 1-2 0L3.6 14.2a1.4 1.4 0 0 1 0-2l9-8.6Z"/><circle cx="16.4" cy="7.6" r="1.2" fill="currentColor" stroke="none"/>',
  bell: '<path d="M6.4 16.4V11a5.6 5.6 0 0 1 11.2 0v5.4l1.6 2.2H4.8l1.6-2.2Z"/><path d="M10.2 21a2 2 0 0 0 3.6 0"/>',
  sort: '<path d="M4.4 6.4h11M4.4 12h7.6M4.4 17.6h4.4M17.4 10v8.6M14.6 16.2l2.8 2.8 2.8-2.8"/>',
  restore: '<path d="M4.6 9.4a8 8 0 1 1 .6 4.6"/><path d="M3.8 4.8v4.8h4.8"/>',
  folder:
    '<path d="M3.6 7.2c0-1 .8-1.8 1.8-1.8h3.3l2 2.2h7.9c1 0 1.8.8 1.8 1.8v8.8c0 1-.8 1.8-1.8 1.8H5.4c-1 0-1.8-.8-1.8-1.8V7.2Z"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M4.1 4.1l1.5 1.5M18.4 18.4l1.5 1.5M2.6 12h2M19.4 12h2M4.1 19.9l1.5-1.5M18.4 5.6l1.5-1.5"/>',
  monitor:
    '<rect x="3.4" y="4.6" width="17.2" height="12" rx="2"/><path d="M9 20h6M12 16.6V20"/>',
  copy: '<rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.2"/><path d="M15.6 8.4V6.2c0-1-.8-1.8-1.8-1.8H5.8C4.8 4.4 4 5.2 4 6.2v8c0 1 .8 1.8 1.8 1.8h2.6"/>',
  note: '<rect x="4.4" y="3.6" width="15.2" height="16.8" rx="2.6"/><path d="M8.2 8.2h7.6M8.2 12h7.6M8.2 15.8h4.4"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.8h.01"/>',
  highlighter:
    '<path d="M9.4 6.6l8 8-3.9 3.9-8-8a1.6 1.6 0 0 1 0-2.3l.6-.6a1.6 1.6 0 0 1 2.3 0Z"/><path d="M8.6 15.4 4.9 19l-1 .1.1-1 3.6-3.7"/>',
  'list-bullet':
    '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><g fill="currentColor" stroke="none"><circle cx="4.6" cy="6.5" r="1.4"/><circle cx="4.6" cy="12" r="1.4"/><circle cx="4.6" cy="17.5" r="1.4"/></g>',
  'list-number':
    '<path d="M9.4 6.5h10.6M9.4 12H20M9.4 17.5H20"/><g fill="currentColor" stroke="none" font-size="7.5" font-weight="600"><text x="3" y="8.9">1</text><text x="3" y="14.4">2</text><text x="3" y="19.9">3</text></g>',
  'clear-format':
    '<path d="M4.6 5.4h9.2M9.2 5.4 7.2 18.4M4.4 18.4h6"/><path d="M14.6 11.6l4.8 4.8M19.4 11.6l-4.8 4.8"/>',
  'chevron-down': '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
  drag: '<g fill="currentColor" stroke="none"><circle cx="9" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="17" r="1.2"/><circle cx="15" cy="17" r="1.2"/></g>'
};

interface Props {
  name: string;
  size?: number;
  stroke?: number;
  class?: string;
}

let { name, size = 24, stroke = 1.8, class: className = '' }: Props = $props();
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
