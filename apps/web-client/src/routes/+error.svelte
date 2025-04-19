<script lang="ts">
	import { Page } from "$lib/controllers";

	import { base } from "$app/paths";
	import { page } from "$app/stores";

	$: ({ status, data } = $page);

	$: ({ plugins } = data);
	$: db = data.dbCtx?.db;
</script>

<Page title="Error" view="error" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col justify-center">
		<div class="card-bordered card mx-auto flex -translate-y-1/2 flex-col items-center gap-y-4 border-base-content p-2 sm:max-w-lg">
			<div class="card-body flex flex-col gap-y-4 text-left">
				<div class="flex flex-col gap-y-2">
					<div class="card-title flex gap-x-2">
						<span class="badge-error badge badge-md">{status}</span>
						<h2 class="text-xl font-semibold text-gray-700">Something crashed!</h2>
					</div>

					<p class="text-base text-gray-700">Try checking your internet connection if you're using an online database.</p>
				</div>

				<div class="card-actions self-end">
					<a href="{base}/" class="btn-primary btn"> Reload </a>
				</div>
			</div>
		</div>
	</div>
</Page>
