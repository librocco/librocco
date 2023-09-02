import { type Writable, get } from "svelte/store";

import type { WarehouseInterface } from "@librocco/db";
import { debug } from "@librocco/shared";

import { readableFromStream } from "$lib/utils/streams";

interface createWarehouseDiscountStore {
	(ctx: debug.DebugCtx, entity: WarehouseInterface | undefined): Writable<number | undefined>;
}

/**
 * Creates a discount percentage store for a warehouse:
 * - the store listens to updates in the database and streams the value for the discountPercentage to the UI
 * - propagates the update of discountPercentage (from the UI) to the database.
 * @param ctx Debug context
 * @param warehouse the warehouse interface
 */
export const createWarehouseDiscountStore: createWarehouseDiscountStore = (ctx, warehouse) => {
	const internalStore = readableFromStream(ctx, warehouse?.stream().discount(ctx), 0);

	const set = (discountPercentage: number) => {
		const currentDiscountPercentage = get(internalStore);

		// If the value passed in is empty, or the same as the current value, noop, to prevent infinite updates
		if (typeof discountPercentage != "number" || discountPercentage === currentDiscountPercentage) {
			debug.log(ctx, "discount_store:set:noop")({ discountPercentage, currentDiscountPercentage });
			return;
		}

		warehouse?.setDiscount(ctx, discountPercentage);
	};

	const update = (fn: (discountPercentage: number | undefined) => number) => {
		set(fn(get(internalStore)));
	};

	return { subscribe: internalStore.subscribe, set, update };
};
