export const generateUpdatedAtString = (updatedAt?: Date | string, mode?: "time-only") =>
	updatedAt &&
	(mode === "time-only"
		? new Date(updatedAt).toLocaleTimeString("en", {
				hour: "2-digit",
				minute: "numeric"
			})
		: new Date(updatedAt).toLocaleDateString("en", {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "numeric"
			}));
