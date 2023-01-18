export const generateUpdatedAtString = (updatedAt: Date) =>
	updatedAt.toLocaleDateString('en', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: 'numeric'
	});
