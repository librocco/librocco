---
name: CounterBadge
description: A numeric badge component displaying a label with a corresponding value. Use for showing counts, totals, or summary statistics in a compact, visually distinct format.
usage: generic
---

## Overview

The `CounterBadge` component displays a label with an associated numeric value in a compact card format. It's designed to show summary statistics like totals, counts, or quantities with a clean, minimal design.

## Import

```ts
import { CounterBadge } from "$lib/components-new/CounterBadge";
```

## Basic Usage

```svelte
<script>
  let total = 42;
</script>

<CounterBadge label="Total Items" value={total} />
```

## Examples

### Basic Counter

```svelte
<CounterBadge label="Total Ordered" value={14} />
```

### Zero State

```svelte
<CounterBadge label="Total Delivered" value={0} />
```

### Dynamic Value

```svelte
<script>
  let processed = 0;

  function increment() {
    processed += 1;
  }
</script>

<CounterBadge label="Processed" value={processed} />
<button on:click={increment}>+1</button>
```

### Multiple Counters

```svelte
<div class="flex gap-4">
  <CounterBadge label="Total" value={100} />
  <CounterBadge label="Completed" value={75} />
  <CounterBadge label="Pending" value={25} />
</div>
```

### Large Numbers

```svelte
<CounterBadge label="Revenue" value="$1,234,567" />
```

## API Reference

### Props

- `label: string` - The display label shown above the value (rendered in uppercase)
- `value: string | number` - The counter value to display (defaults to `0`)

## Styling

The component uses these design tokens:

- **Container**: `min-w-[160px] rounded-md border border-neutral-200 bg-background`
- **Padding**: `px-2 py-1`
- **Layout**: `flex items-center justify-between gap-2`
- **Label**: `text-xs uppercase tracking-wide text-muted-foreground`
- **Value**: `text-lg font-bold text-foreground`

## Best Practices

1. **Consistent labeling**: Use clear, concise labels that describe what the value represents
2. **Appropriate data limits**: CounterBadge is designed for summary statistics, not lists or data
3. **Grouping related counters**: Place multiple CounterBadge components together to show related metrics
4. **Accessibility**: The component provides clear visual separation between label and value

## Notes

- The label is always rendered in uppercase using CSS `uppercase`
- The minimum width of `160px` ensures consistent sizing across different values
- The component does not include click handlers - it's purely for display purposes
