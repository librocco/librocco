/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, test, expect, vi } from 'vitest';
import { screen, render, cleanup } from '@testing-library/svelte';

import SideNavButton from '../SideNavButton.svelte';

beforeEach(() => {
	vi.clearAllMocks();
	cleanup();
});

describe('SideNavButton', () => {
	test("should propagate 'click' event", () => {
		const mockOnClick = vi.fn();
		const { component } = render(SideNavButton);
		component.$on('click', mockOnClick);
		screen.getByRole('button').click();
		expect(mockOnClick).toHaveBeenCalled();
	});

	test("should render the component with html tags provided as 'as' prop", () => {
		render(SideNavButton);
		// The default should be <button>
		screen.getByRole('button');
		expect(screen.queryByRole('nav')).toBeFalsy();
		// Now the <nav> should be rendered instead of button
		cleanup();
		render(SideNavButton, { as: 'nav' });
		screen.getByRole('navigation');
		expect(screen.queryByRole('button')).toBeFalsy();
	});
});
