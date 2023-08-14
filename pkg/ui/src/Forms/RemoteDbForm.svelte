<script lang="ts">
	import { createForm } from "felte";
	import { ChevronUp, ChevronDown } from "lucide-svelte";

	import { TextField, Checkbox } from "../FormFields";
	import { Button, ButtonColor } from "../Button";

    import type { RemoteDbConfig } from "./types";

	export let data: Partial<RemoteDbConfig> = {};
	export let onSubmit: (values: RemoteDbConfig) => void = () => {};

    const defaultValues = {
        direction: "sync" as const,
        live: true,
        retry: true
    }

	const { form, data: dataStore } = createForm({
		initialValues: { ...defaultValues, ...data },
        onSubmit: (values) => {
            onSubmit(values)
        }
	});
</script>

<form class="divide-y-gray-50 flex h-auto flex-col gap-y-6 divide-y-2" use:form aria-label="Edit remote database connection config">
	<div class="flex flex-col justify-between gap-6 lg:flex-row-reverse">
		<div class="flex grow flex-col flex-wrap gap-y-4 lg:flex-row">
			<div class="basis-full">
				<TextField
					id="url"
					name="url"
					label="Remote CouchDB URL"
					required={true}
                    pattern="^(https?://)(.+):(.+)@(.+):(.+)$"
				>
                    <p slot="helpText">URL format: <span class="italic">https://user:password@host:post/db_name</span></p>
                </TextField>
			</div>
            <div>
                <details>
                    <summary class="flex cursor-pointer items-center justify-between py-3">
                        <span id="open" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
                            <ChevronUp /> Less options
                        </span>
                        <span id="closed" class="inline-flex items-center gap-x-2 text-base leading-6 text-gray-600">
                            <ChevronDown size={24}/> More options
                        </span>
                    </summary>
                    <div class="flex flex-col gap-y-6 pl-8">
                        <div class="flex flex-col gap-y-2">
                            <label for="direction" class={"text-sm font-medium text-gray-700"}>
                                Sync direction
                            </label>
                            <select id="direction" name="direction" class="appearance-none">
                                <option value="to">➡️ To remote</option>
                                <option value="from">⬅️ From remote</option>
                                <option value="sync">↔️ Sync with remote</option>
                            </select>
                        </div>
                        <Checkbox id="live" name="live" label="Live" helpText="Watch for and sync new changes as they become available." />
                        <Checkbox 
							id="retry"
                            name="retry" 
                            label="Retry" 
                            helpText="Automatically retry sync on failure. Otherwise connections will have to be manually restarted." 
                            disabled={!$dataStore.live}
                        />
                    </div>
                </details>
            </div>
		</div>
	</div>
	<div class="flex justify-end gap-x-2 px-4 py-6">
		<Button type="submit" color={ButtonColor.Primary}>Start sync</Button>
	</div>
</form>

<style>
    /** Select styles */
    select {
        border-radius: 6px;
        border-width: 1px;
        /** gray-300 */
        border-color: rgb(209 213 219);
    }

    select:focus {
        outline: none;
        outline-style: none;
        box-shadow: none;  
        /** teal-500 */
        outline: 2px solid rgb(20 184 166);
    }

    /** Details styles */
	details summary::-webkit-details-marker {
		display: none;
	}

	details > summary > span {
		transition-property: opacity;
		transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
		transition-duration: 200ms;
	}

	details > summary > #open {
		visibility: hidden;
		width: 0;
		margin-left: 0;
		opacity: 0;
	}

	details[open] > summary > #open {
		visibility: visible;
		width: fit-content;
		margin-right: auto;
		opacity: 100;
	}

	details > summary > #closed {
		visibility: visible;
		width: fit-content;
		margin-right: auto;
		opacity: 100;
	}

	details[open] > summary > #closed {
		visibility: hidden;
		width: 0;
		margin-left: 0;
		opacity: 0;
	}

	@keyframes open {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	details[open] summary ~ * {
		animation: open 0.2s;
	}
</style>