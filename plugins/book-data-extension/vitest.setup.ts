import { expect } from "vitest";

const matchers = await import("@testing-library/jest-dom/matchers").then(m => m.default || m);

// Add custom jest matchers
expect.extend(matchers);
