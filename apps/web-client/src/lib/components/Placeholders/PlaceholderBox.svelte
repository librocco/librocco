<script lang="ts">
	export let title = "";
	export let description = "";
</script>

<div class="card-bordered card border-base-content">
	<div class="card-body gap-y-4">
		<div class="flex flex-col gap-y-2">
			<div class="card-title flex items-center gap-x-4">
				<slot name="icon" />
				<p class="card-title">{title}</p>
			</div>
			<p>{description}</p>
		</div>

		<div class="card-actions">
			<slot name="actions" />
		</div>
	</div>
</div>
