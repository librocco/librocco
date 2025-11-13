/**
 * @deprecated Use i18n date formatters instead:
 * - `$LL.dateTime()` for date with time
 * - `$LL.timeOnly()` for time only
 * - `$LL.dateShort()` for short date without year
 * - `$LL.dateMedium()` for date with year
 *
 * This function has been deprecated in favor of locale-aware formatters
 * that properly internationalize dates according to the user's language preference.
 */
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
