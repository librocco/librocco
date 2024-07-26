// This is here so that /history/warehouse/[warehouseId] route (without [from]/[to] segments) will get matched
// The layout load will handle redirects in such cases, but without +page.ts / +page.svelte here the route will be 404
export const load = () => Promise.resolve();
