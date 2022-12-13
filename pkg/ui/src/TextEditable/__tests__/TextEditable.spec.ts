/**
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent, act } from '@testing-library/svelte';
import { describe, test, expect } from 'vitest';

import TestComponent from './TestComponent.svelte';

describe('TextEditable', () => {
	test('should update the value of the text displayed in the component if the bound value gets updated', async () => {
		render(TestComponent, { isEditing: true });
		const [testInput, componentInput] = screen.getAllByRole('textbox');
		await act(() => fireEvent.input(testInput, { target: { value: 'New value' } }));
		// The value of the component input should be updated immediatedly
		expect(componentInput).toHaveProperty('value', 'New value');
	});

	test('should propagate the update only when the form is saved', async () => {
		render(TestComponent, { isEditing: true });
		const [testInput, componentInput] = screen.getAllByRole('textbox');
		await act(() => fireEvent.input(componentInput, { target: { value: 'New value' } }));
		// The value of the test input should not be updated before saving
		expect(testInput).toHaveProperty('value', '');
		// After saving, the bound value (and thus 'controlInput') should be updated
		await act(() => fireEvent.keyDown(componentInput, { key: 'Enter' }));
		expect(testInput).toHaveProperty('value', 'New value');
	});
});
