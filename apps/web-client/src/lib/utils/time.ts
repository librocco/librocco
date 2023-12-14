export const generateUpdatedAtString = (updatedAt?: Date | string) =>
	updatedAt &&
	new Date(updatedAt).toLocaleDateString("en", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "numeric"
	});
