<script lang="ts">
	import { BadgeColor, BadgeSize } from "./enums";

	export let label: string;
	export let size: BadgeSize = BadgeSize.Base;
	export let color: BadgeColor = BadgeColor.Neutral;

	/**
	 * ```yaml
	 * Neutral:
	 * 	bg-gray-100 text-gray-800
	 * Error:
	 * 	bg-red-100 px-2.5 text-red-800
	 * Warning:
	 * 	bg-yellow-100 text-yellow-800
	 * Success:
	 * bg-teal-100 text-teal-800
	 * ```
	 */

	export const colorClassesLookup: Record<BadgeColor, string> = {
		[BadgeColor.Neutral]: "bg-gray-100 text-gray-800",
		[BadgeColor.Error]: "bg-red-100 px-2.5 text-red-800",
		[BadgeColor.Warning]: "bg-yellow-100 text-yellow-800",
		[BadgeColor.Success]: "bg-teal-100 text-teal-800"
	};

	export const sizeLookup: Record<BadgeSize, string> = {
		[BadgeSize.Base]: "px-2.5 py-0.5 text-xs",
		[BadgeSize.LG]: "px-3 py-0.5 text-sm"
	};

	$: colorAndSize = [colorClassesLookup[color], sizeLookup[size]].join(" ");
</script>

<span class={["inline-flex items-center rounded", colorAndSize].join(" ")}>{label}</span>
