export type OrderLineStatus = "draft" | "placed" | "received" | "collected";
export type OrderStatus = "in_progress" | "completed";

export function getOrderLineStatus(line: { placed?: number; received?: number; collected?: number }): OrderLineStatus {
	const { placed, received, collected } = line;

	// TODO: should we validate timestamp values?

	// Check for collected status - requires all timestamps in correct order
	if (placed && received && collected && placed <= received && received <= collected) {
		return "collected";
	}

	// Check for received status - requires placed and received timestamps in order
	if (placed && received && placed <= received) {
		return "received";
	}

	// Check for placed status - only requires placed timestamp
	if (placed) {
		return "placed";
	}

	// Default status when no timestamps are present
	return "draft";
}

export function getOrderStatus(orderLines: { placed?: number; received?: number; collected?: number }[]): OrderStatus {
	const allCollected = orderLines.every((line) => getOrderLineStatus(line) === "collected");
	return allCollected ? "completed" : "in_progress";
}
