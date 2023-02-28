import { expect } from 'vitest';
import matchers, { type TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// Required to appease TS
// Merges standard matchers declaration with js-dom extensions
declare global {
	namespace Vi {
		interface JestAssertion<T = any> extends jest.Matchers<void, T>, TestingLibraryMatchers<T, void> {}
	}
}

// Add custom jest matchers
expect.extend(matchers);
