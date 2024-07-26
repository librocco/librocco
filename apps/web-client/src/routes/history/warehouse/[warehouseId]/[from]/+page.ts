// This is here so that /history/warehouse/[warehouseId]/[from] route (without [to] segment) will get matched
// The layout load will handle redirects in such cases, but without +page.ts / +page.svelte here the route will be 404
export const load = () => Promise.resolve();
