import { timeOnly as formatTimeOnly, dateTime as formatDateTime } from "@librocco/shared/i18n-formatters";

export const generateUpdatedAtString = (updatedAt?: Date | string, mode?: "time-only") => {
	if (!updatedAt) return "";

	return mode === "time-only" ? formatTimeOnly(updatedAt) : formatDateTime(updatedAt);
};
