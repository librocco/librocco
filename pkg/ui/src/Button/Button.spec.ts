/**
 * @vitest-environment jsdom
 */

import { describe, test, vi, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';

import Button from './Button.svelte';

describe('Button', () => {
	describe('smoke test', () => {
		afterEach(() => {
			cleanup();
		});

		test('should propagate click event', () => {
			const mockClick = vi.fn();
			const { component } = render(Button);
			component.$on('click', mockClick);
			screen.getByRole('button').click();

			expect(mockClick).toHaveBeenCalled();
		});
	});
});
