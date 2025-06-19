<script lang="ts">
	import { Page } from "$lib/controllers";

	import { base } from "$app/paths";
	import { page } from "$app/stores";
	import { LL } from "@librocco/shared/i18n-svelte";

	$: ({ status, data } = $page);

	$: ({ plugins } = data);
	$: db = data.dbCtx?.db;

	$: ({ error_page: tErrorPage, common: tCommon } = $LL);
</script>

<Page title={tErrorPage.title()} view="error" {db} {plugins}>
	<div slot="main" class="flex h-full flex-col justify-center">
		<div class="card-bordered card mx-auto flex -translate-y-1/2 flex-col items-center gap-y-4 border-base-content p-2 sm:max-w-lg">
			<div class="card-body flex flex-col gap-y-4 text-left">
				<div class="flex flex-col gap-y-2">
					<div class="card-title flex gap-x-2">
						<span class="badge-error badge badge-md">{status}</span>
						<h2 class="text-xl font-semibold text-gray-700">{tErrorPage.message.title()}</h2>
					</div>

					<p class="text-base text-gray-700">{tErrorPage.message.description()}</p>
				</div>

				<div class="card-actions self-end">
					<a href="{base}/#/" class="btn-primary btn">{tCommon.actions.reload()}</a>
				</div>
			</div>
		</div>
	</div>
</Page>
