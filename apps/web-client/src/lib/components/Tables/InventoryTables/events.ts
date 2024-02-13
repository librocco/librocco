import type { EventDispatcher } from "svelte";

import type { InventoryTableData, OutboundTableData } from "../types";

import type { WarehouseChangeDetail } from "$lib/components";

export const createInboundTableEvents = (dispatch: EventDispatcher<InboundTableEvents>) => {
	return {
		editQuantity: createEditQuantityEvent(dispatch)
	};
};

export const createOutboundTableEvents = (dispatch: EventDispatcher<OutboundTableEvents>) => {
	return {
		editQuantity: createEditQuantityEvent(dispatch),
		editWarehouse: (event: CustomEvent<WarehouseChangeDetail>, row: OutboundTableData) => {
			dispatch("edit-row-warehouse", { event, row });
		}
	};
};

const createEditQuantityEvent = (dispatch: EventDispatcher<EditQuantityEvent>) => (event: SubmitEvent, row: InventoryTableData) => {
	dispatch("edit-row-quantity", { event, row });
};

export type InboundTableEvents = EditQuantityEvent;
export type OutboundTableEvents = EditQuantityEvent & EditWarehouseEvent;

type EditQuantityEvent = {
	"edit-row-quantity": { event: SubmitEvent; row: InventoryTableData };
};

type EditWarehouseEvent = {
	"edit-row-warehouse": {
		event: CustomEvent<WarehouseChangeDetail>;
		row: OutboundTableData;
	};
};
