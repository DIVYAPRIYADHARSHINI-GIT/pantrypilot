<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}
	let {
		open = $bindable(),
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		onconfirm,
		oncancel
	}: Props = $props();

	let dialogEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (open && dialogEl) {
			const btn = dialogEl.querySelector<HTMLButtonElement>('[data-autofocus]');
			btn?.focus();
		}
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}
</script>

<svelte:window on:keydown={open ? onkeydown : undefined} />

{#if open}
	<div
		class="backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) oncancel();
		}}
	>
		<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" bind:this={dialogEl}>
			<h3 id="dlg-title">{title}</h3>
			{#if message}<p class="muted">{message}</p>{/if}
			<div class="btn-row" style="justify-content:flex-end;margin-top:14px">
				<button class="btn" onclick={oncancel}>{cancelLabel}</button>
				<button class="btn {danger ? 'btn-danger' : 'btn-primary'}" data-autofocus onclick={onconfirm}>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 24, 18, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		z-index: 100;
		animation: fade 0.14s ease;
	}
	.dialog {
		background: var(--surface);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 20px;
		max-width: 400px;
		width: 100%;
	}
	.dialog h3 {
		margin-bottom: 6px;
	}
	.dialog p {
		margin: 0;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
</style>
