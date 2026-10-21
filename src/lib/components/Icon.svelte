<script lang="ts">
	// Original SVG icon set drawn for PantryPilot. No emoji, no third-party art.
	interface Props {
		name: string;
		size?: number;
		title?: string;
		class?: string;
	}
	let { name, size = 22, title, class: cls = '' }: Props = $props();
</script>

<svg
	class={cls}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={title ? 'img' : 'presentation'}
	aria-hidden={title ? undefined : 'true'}
	aria-label={title}
>
	{#if title}<title>{title}</title>{/if}

	{#if name === 'home'}
		<path d="M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1h-5v-5h-5v5h-5a1 1 0 0 1-1-1z" />
	{:else if name === 'pantry'}
		<rect x="4" y="3.5" width="16" height="17" rx="2" />
		<path d="M4 12h16M10 7.5h1M10 16h1" />
	{:else if name === 'scan'}
		<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
		<path d="M7.5 12h9" />
	{:else if name === 'recipes'}
		<path d="M12 4a4 4 0 0 1 4 4c0 1.5-.8 2.3-1.3 3-.4.6-.7 1.1-.7 2h-4c0-.9-.3-1.4-.7-2C8.8 10.3 8 9.5 8 8a4 4 0 0 1 4-4Z" />
		<path d="M10 16h4M10.5 19h3" />
	{:else if name === 'list'}
		<path d="M8 6.5h11M8 12h11M8 17.5h11" />
		<circle cx="4.6" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
		<circle cx="4.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
		<circle cx="4.6" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
	{:else if name === 'chart'}
		<path d="M4 20V4M4 20h16" />
		<path d="M8 17v-5M12.5 17V7.5M17 17v-7" />
	{:else if name === 'settings'}
		<circle cx="12" cy="12" r="3" />
		<path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
	{:else if name === 'dairy'}
		<path d="M9 3.5h6v2.3l1.8 2.7V20a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1V8.5L9 5.8Z" />
		<path d="M7.2 12.5h9.6" />
	{:else if name === 'vegetables'}
		<path d="M12 20c-3.6 0-6.5-2.8-6.5-6.3 0-3 2.3-5.4 5.2-5.4.5 0 1 .07 1.3.2.4-.13.8-.2 1.3-.2 2.9 0 5.2 2.4 5.2 5.4C18.5 17.2 15.6 20 12 20Z" />
		<path d="M12 8.5V5.2M12 5.2c1.6 0 2.6-1 2.8-2.2-1.6-.2-2.8.9-2.8 2.2Z" />
	{:else if name === 'fruits'}
		<circle cx="12" cy="13.5" r="6.3" />
		<path d="M12 7.2V4.4M12 4.4c1.5 0 2.4-.9 2.6-2-1.5-.2-2.6.8-2.6 2Z" />
	{:else if name === 'grains'}
		<path d="M12 20V7" />
		<path d="M12 9.5c-2.6 0-4-1.6-4-3.6 2.6 0 4 1.5 4 3.6ZM12 9.5c2.6 0 4-1.6 4-3.6-2.6 0-4 1.5-4 3.6ZM12 14.5c-2.6 0-4-1.6-4-3.6 2.6 0 4 1.5 4 3.6ZM12 14.5c2.6 0 4-1.6 4-3.6-2.6 0-4 1.5-4 3.6Z" />
	{:else if name === 'snacks'}
		<path d="M5.5 8.5h13l-1.3 10.2a1 1 0 0 1-1 .8H7.8a1 1 0 0 1-1-.8Z" />
		<path d="M8.5 8.5V6.2A2.2 2.2 0 0 1 10.7 4h2.6a2.2 2.2 0 0 1 2.2 2.2v2.3" />
	{:else if name === 'meat'}
		<path d="M14.2 4.2a5 5 0 0 1 4 7.6l-6.6 7.1a3.1 3.1 0 0 1-4.6-4.2l7.2-6.3" />
		<circle cx="15.4" cy="8.3" r="1.5" />
	{:else if name === 'beverages'}
		<path d="M7.5 4.5h9l-1 14.3a1 1 0 0 1-1 .95h-5a1 1 0 0 1-1-.95Z" />
		<path d="M7.9 10.2h8.2" />
	{:else if name === 'bakery'}
		<path d="M4.5 13.5c0-3.4 3.4-6 7.5-6s7.5 2.6 7.5 6v3.8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z" />
		<path d="M8.5 18V9.2M12 18V7.8M15.5 18V9.2" />
	{:else if name === 'spices'}
		<path d="M8 9.5h8l-.8 9.6a1 1 0 0 1-1 .9h-4.4a1 1 0 0 1-1-.9Z" />
		<path d="M9.4 9.5V6.8a2.6 2.6 0 0 1 5.2 0v2.7M10.6 5.2h2.8" />
	{:else if name === 'frozen'}
		<path d="M12 3.5v17M4.6 7.8l14.8 8.4M19.4 7.8 4.6 16.2" />
		<path d="M12 6.6 10 4.8M12 6.6l2-1.8M12 17.4l-2 1.8M12 17.4l2 1.8" />
	{:else if name === 'household'}
		<path d="M9.5 20h5l.7-8.5h-6.4Z" />
		<path d="M10.8 11.5V7.4a1.2 1.2 0 0 1 1.2-1.2 1.2 1.2 0 0 0 1.2-1.2V4" />
	{:else if name === 'other'}
		<circle cx="12" cy="12" r="8" />
		<path d="M12 8.6v4.2M12 15.8h.01" />
	{:else if name === 'plus'}
		<path d="M12 5.5v13M5.5 12h13" />
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="6.3" />
		<path d="M15.6 15.6 20 20" />
	{:else if name === 'barcode'}
		<path d="M4 6v12M7.2 6v12M10.4 6v8M13.6 6v12M16.8 6v8M20 6v12" />
	{:else if name === 'camera'}
		<path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
		<circle cx="12" cy="13.5" r="3.2" />
	{:else if name === 'trash'}
		<path d="M4.8 6.8h14.4M9.5 6.8V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.6" />
		<path d="M6.6 6.8 7.5 19a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l.9-12.2M10.3 10v6.3M13.7 10v6.3" />
	{:else if name === 'edit'}
		<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10Z" />
		<path d="M14.5 6.5l3 3" />
	{:else if name === 'check'}
		<path d="M5 12.6 9.6 17 19 7.5" />
	{:else if name === 'close'}
		<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
	{:else if name === 'warning'}
		<path d="M12 4.3 21 19.5H3Z" />
		<path d="M12 10v4.1M12 16.8h.01" />
	{:else if name === 'bell'}
		<path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 3.6 1.3 5 1.8 5.6H4.7c.5-.6 1.8-2 1.8-5.6Z" />
		<path d="M10.2 19a2 2 0 0 0 3.6 0" />
	{:else if name === 'rotate'}
		<path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7" />
		<path d="M19.8 4.8v4h-4" />
	{:else if name === 'crop'}
		<path d="M6.5 3.5v14h14" />
		<path d="M3.5 6.5h14v14" />
	{:else if name === 'download'}
		<path d="M12 4v10.5M7.8 10.6 12 14.8l4.2-4.2" />
		<path d="M4.5 19.5h15" />
	{:else if name === 'upload'}
		<path d="M12 15.5V5M7.8 8.9 12 4.7l4.2 4.2" />
		<path d="M4.5 19.5h15" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2.8v2M12 19.2v2M21.2 12h-2M5 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5" />
	{:else if name === 'moon'}
		<path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5a7.9 7.9 0 1 0 9.7 9.7Z" />
	{:else if name === 'leaf'}
		<path d="M5 19s-1.5-7 3.5-11S19 4 19 4s.6 7.5-3.5 11S5 19 5 19Z" />
		<path d="M9 15 16 8" />
	{:else}
		<circle cx="12" cy="12" r="8" />
	{/if}
</svg>
