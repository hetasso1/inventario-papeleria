<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type ButtonVariant =
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link"
		| "success";
	type ButtonSize = "default" | "sm" | "lg" | "icon";

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		children?: Snippet;
		disabled?: boolean;
		type?: "button" | "submit" | "reset";
	}

	let {
		variant = "default",
		size = "default",
		class: className = "",
		children,
		disabled = false,
		type = "button",
		...restProps
	}: Props = $props();

	const variantStyles: Record<ButtonVariant, string> = {
		default:
			"bg-black text-white hover:bg-black/90 shadow-sm border border-transparent",
		destructive:
			"bg-red-600 text-white hover:bg-red-600/90 shadow-sm border border-transparent",
		outline:
			"border border-border bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 shadow-sm",
		secondary:
			"bg-slate-100 text-slate-900 hover:bg-slate-200/80 shadow-sm border border-transparent",
		ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
		link: "text-slate-900 underline-offset-4 hover:underline",
		success:
			"bg-emerald-600 text-white hover:bg-emerald-600/90 shadow-sm border border-transparent",
	};

	const sizeStyles: Record<ButtonSize, string> = {
		default: "h-9 px-4 py-2 text-sm",
		sm: "h-8 rounded-md px-3 text-xs",
		lg: "h-10 rounded-md px-6 text-sm",
		icon: "h-9 w-9 p-0",
	};
</script>

<button
	{type}
	{disabled}
	class={cn(
		"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors cursor-pointer",
		"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
		"disabled:pointer-events-none disabled:opacity-50 select-none",
		variantStyles[variant],
		sizeStyles[size],
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</button>
