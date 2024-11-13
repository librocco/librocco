export type OrderLineStatus = "draft" | "placed" | "received" | "collected";
export type OrderStatus = "in_progress" | "completed";

export function getOrderLineStatus(line: { placed?: number; received?: number; collected?: number }): OrderLineStatus {
	if (line.collected && line.received && line.placed) {
		// Verify chronological order
		if (line.placed <= line.received && line.received <= line.collected) {
			return "collected";
		}
	}

	if (line.received && line.placed) {
		if (line.placed <= line.received) {
			return "received";
		}
	}

	if (line.placed) {
		return "placed";
	}

	return "draft";
}

export function getOrderStatus(orderLines: { placed?: number; received?: number; collected?: number }[]): OrderStatus {
	const allCollected = orderLines.every((line) => getOrderLineStatus(line) === "collected");
	return allCollected ? "completed" : "in_progress";
}
