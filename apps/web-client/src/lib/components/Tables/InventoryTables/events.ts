import type { EventDispatcher } from "svelte";

import type { InventoryTableData } from "../types";

export const createInboundTableEvents = (dispatch: EventDispatcher<InboundTableEvents>) => {
	return {
		editQuantity: createEditQuantityEvent(dispatch)
	};
};

export const createOutboundTableEvents = (dispatch: EventDispatcher<OutboundTableEvents>) => {
	return {
		editQuantity: createEditQuantityEvent(dispatch),
		editWarehouse: (event: Event, row: InventoryTableData) => {
			dispatch("edit-row-warehouse", { event, row });
		}
	};
};

const createEditQuantityEvent = (dispatch: EventDispatcher<EditQuantityEvent>) => (event: SubmitEvent) => {
	dispatch("edit-row-quantity", event);
};

export type InboundTableEvents = EditQuantityEvent;
export type OutboundTableEvents = EditQuantityEvent & EditWarehouseEvent;

type EditQuantityEvent = {
	"edit-row-quantity": SubmitEvent;
};

type EditWarehouseEvent = {
	"edit-row-warehouse": {
		event: Event;
		row: InventoryTableData;
	};
};
