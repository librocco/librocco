<script lang="ts">
	import { getLocalTimeZone, now, type DateValue } from "@internationalized/date";
	import { createDatePicker, melt } from "@melt-ui/svelte";
	import { Calendar, ChevronLeft, ChevronRight } from "lucide-svelte";
	import { fade } from "svelte/transition";

	import { testId } from "@librocco/shared";

	export let defaultValue: DateValue = now(getLocalTimeZone());
	export let onValueChange: (args: { curr: DateValue; next: DateValue }) => DateValue = ({ next }) => next;
	let checkIsDateDisabled: (date: DateValue) => boolean = () => false;
	export { checkIsDateDisabled as isDateDisabled };

	const {
		elements: { calendar, cell, content, field, grid, heading, nextButton, prevButton, segment, trigger },
		states: { months, headingValue: monthHeading, weekdays, segmentContentsObj, open },
		helpers: { isDateDisabled, isDateUnavailable }
		// create a ZonedDateTime object with the current date and time
	} = createDatePicker({
		// 'date' param should always be defined as the route doesn't render without the date param
		defaultValue,
		isDateDisabled: checkIsDateDisabled,
		onValueChange,
		preventDeselect: true
	});

	// segments
	$: day = $segmentContentsObj.day;
	$: month = $segmentContentsObj.month;
	$: year = $segmentContentsObj.year;
	$: hour = $segmentContentsObj.hour;
	$: minute = $segmentContentsObj.minute;
	$: dayPeriod = $segmentContentsObj.dayPeriod;
</script>

<div>
	<div
		class="mt-1.5 flex min-w-[200px] items-center gap-x-1 rounded-lg border border-gray-400 bg-gray-50 p-1.5 px-4 text-gray-600"
		use:melt={$field}
	>
		<p class="flex items-center gap-x-0.5">
			<span use:melt={$segment("day")}>{day}</span>
			<span>/</span>
			<span use:melt={$segment("month")}>{month}</span>
			<span>/</span>
			<span use:melt={$segment("year")}>{year},</span>
		</p>

		<p class="flex items-center">
			<span use:melt={$segment("hour")}>{hour}</span>
			<span>:</span>
			<span use:melt={$segment("minute")}>{minute}</span>
			<span class="ml-1 block" use:melt={$segment("dayPeriod")}>{dayPeriod}</span>
		</p>

		<button
			data-testid={testId("calendar-picker-control")}
			data-open={$open}
			class="rounded-md p-1 text-gray-600 transition-all"
			use:melt={$trigger}
		>
			<Calendar size={20} />
		</button>
	</div>
</div>

{#if $open}
	<div
		data-testid={testId("calendar-picker")}
		class="z-10 min-w-[320px] rounded-lg bg-white shadow-sm"
		transition:fade={{ duration: 100 }}
		use:melt={$content}
	>
		<div class="w-full rounded-lg bg-white p-3 text-gray-600 shadow-sm" use:melt={$calendar}>
			<div data-testid={testId("calendar-picker-month-select")} class="flex items-center justify-between pb-2">
				<button class="rounded-lg p-1 transition-all" use:melt={$prevButton}>
					<ChevronLeft size={24} />
				</button>
				<div class="flex items-center gap-6" use:melt={$heading}>
					{$monthHeading}
				</div>
				<button class="rounded-lg p-1 transition-all" use:melt={$nextButton}>
					<ChevronRight size={24} />
				</button>
			</div>
			<div>
				{#each $months as month}
					<table class="w-full" use:melt={$grid}>
						<thead aria-hidden="true">
							<tr>
								{#each $weekdays as day}
									<th class="text-sm font-semibold">
										<div class="flex h-6 w-6 items-center justify-center p-4">
											{day}
										</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each month.weeks as weekDates}
								<tr>
									{#each weekDates as date}
										<td role="gridcell" aria-disabled={$isDateDisabled(date) || $isDateUnavailable(date)}>
											<div data-testid="" use:melt={$cell(date, month.value)}>
												{date.day}
											</div>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style lang="postcss">
	[data-melt-calendar-prevbutton][data-disabled] {
		@apply pointer-events-none rounded-lg p-1 opacity-40;
	}

	[data-melt-calendar-nextbutton][data-disabled] {
		@apply pointer-events-none rounded-lg p-1 opacity-40;
	}

	[data-melt-calendar-heading] {
		@apply font-semibold;
	}

	[data-melt-calendar-grid] {
		@apply w-full;
	}

	[data-melt-calendar-cell] {
		@apply flex h-6 w-6 cursor-pointer select-none items-center justify-center rounded-lg  p-4;
	}

	[data-melt-calendar-cell][data-disabled] {
		@apply pointer-events-none opacity-40;
	}
	[data-melt-calendar-cell][data-unavailable] {
		@apply pointer-events-none text-red-400 line-through;
	}

	[data-melt-calendar-cell][data-selected] {
		@apply bg-teal-400 text-base;
	}

	[data-melt-calendar-cell][data-outside-visible-months] {
		@apply pointer-events-none cursor-default opacity-40;
	}

	[data-melt-calendar-cell][data-outside-month] {
		@apply pointer-events-none cursor-default opacity-0;
	}
</style>
