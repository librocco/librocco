// Get new db per test basis (ids are timestamped for easier debugging)
export const newTestDBName = () => new Date().toISOString().replaceAll(/[.:]/g, "-").toLowerCase();
