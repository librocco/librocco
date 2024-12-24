import type { Breadcrumb } from "./types";

import { appPath } from "$lib/paths";

interface BreadcrumbSegment {
	id: string | number;
	displayName?: string;
}

type WarehouseSegments = [warehouse: BreadcrumbSegment];
type InboundSegments = [warehouse: BreadcrumbSegment, note: BreadcrumbSegment];
type OutboundSegments = [note: BreadcrumbSegment];
type CustomerSegments = [customer: BreadcrumbSegment];

export function createBreadcrumbs(type: "warehouse", ...segments: WarehouseSegments): Breadcrumb[];
export function createBreadcrumbs(type: "inbound", ...segments: InboundSegments): Breadcrumb[];
export function createBreadcrumbs(type: "outbound", ...segments: OutboundSegments): Breadcrumb[];
export function createBreadcrumbs(type: "customers", ...segments: CustomerSegments): Breadcrumb[];

export function createBreadcrumbs(
	type: "warehouse" | "inbound" | "outbound" | "customers",
	...segments: BreadcrumbSegment[]
): Breadcrumb[] {
	switch (type) {
		case "warehouse": {
			const [{ id, displayName }] = segments as WarehouseSegments;
			const label = displayName || `Warehouse - ${id}`;
			return [{ label: "Warehouses", href: appPath("warehouses") }, { label }];
		}

		case "inbound": {
			const [warehouse, note] = segments as InboundSegments;
			const warehouseLabel = warehouse.displayName || `Warehouse - ${warehouse.id}`;
			const noteLabel = note.displayName || `Note - ${note.id}`;
			return [
				{ label: "Inbound", href: appPath("inbound") },
				{ label: warehouseLabel, href: appPath("warehouses", warehouse.id) },
				{ label: noteLabel }
			];
		}

		case "outbound": {
			const [{ id, displayName }] = segments as OutboundSegments;
			const label = displayName || `Note - ${id};`;
			return [{ label: "Outbound", href: appPath("outbound") }, { label }];
		}

		case "customers": {
			const [{ id, displayName }] = segments as OutboundSegments;
			const label = displayName || `Custoer Order - ${id};`;
			return [{ label: "Customers", href: appPath("customers") }, { label }];
		}
	}
}
