import type { Breadcrumb } from "./types";

interface BreadcrumbSegment {
	id: string;
	displayName?: string;
}

type WarehouseSegments = [warehouse: BreadcrumbSegment];
type InboundSegments = [warehouse: BreadcrumbSegment, note: BreadcrumbSegment];
type OutboundSegments = [note: BreadcrumbSegment];

// TEMP
const basepath = "/preview/proto";

export function createBreadcrumbs(type: "warehouse", ...segments: WarehouseSegments): Breadcrumb[];
export function createBreadcrumbs(type: "inbound", ...segments: InboundSegments): Breadcrumb[];
export function createBreadcrumbs(type: "outbound", ...segments: OutboundSegments): Breadcrumb[];
export function createBreadcrumbs(type: "warehouse" | "inbound" | "outbound", ...segments: BreadcrumbSegment[]): Breadcrumb[] {
	switch (type) {
		case "warehouse": {
			const [{ id, displayName }] = segments as WarehouseSegments;
			const label = displayName || id;
			return [{ label: "Warehouses", href: `${basepath}/inventory/warehouses` }, { label }];
		}

		case "inbound": {
			const [warehouse, note] = segments as InboundSegments;
			const warehouseLabel = warehouse.displayName || warehouse.id;
			const noteLabel = note.displayName || note.id;
			return [
				{ label: "Inbound", href: `${basepath}/inventory/inbound` },
				{ label: warehouseLabel, href: `${basepath}/inventory/warehouses/${warehouse.id}` },
				{ label: noteLabel }
			];
		}

		case "outbound": {
			const [{ id, displayName }] = segments as OutboundSegments;
			const label = displayName || id;
			return [{ label: "Outbound", href: `${basepath}/outbound` }, { label }];
		}
	}
}
