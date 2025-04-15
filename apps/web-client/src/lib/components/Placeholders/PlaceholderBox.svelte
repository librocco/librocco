<script lang="ts">
	export let title = "";
	export let description = "";
</script>

<div class="card card-bordered border-base-content">
	<div class="card-body">
		<div class="card-title flex items-center gap-x-4">
			<slot name="icon" />
			<p class="card-title">{title}</p>
		</div>
		<p>{description}</p>
		<div class="card-actions">
			<slot name="actions" />
		</div>
	</div>
</div>
