<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type BadgeVariant =
		| "default"
		| "secondary"
		| "outline"
		| "destructive"
		| "success"
		| "warning";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: BadgeVariant;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = "default",
		class: className = "",
		children,
		...restProps
	}: Props = $props();

	const variantStyles: Record<BadgeVariant, string> = {
		default: "border-transparent bg-black text-white hover:bg-black",
		secondary:
			"border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100",
		outline: "border border-border text-foreground bg-transparent",
		destructive: "border-transparent bg-red-50 text-red-700 border-red-200",
		success:
			"border-transparent bg-emerald-50 text-emerald-700 border-emerald-200",
		warning:
			"border-transparent bg-amber-50 text-amber-700 border-amber-200",
	};
</script>

<div
	class={cn(
		"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
		variantStyles[variant],
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>
