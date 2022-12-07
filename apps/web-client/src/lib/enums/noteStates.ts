export enum NoteState {
	Draft = 'draft',
	Committed = 'committed',
	Deleted = 'deleted'
}

export enum NoteTempState {
	Saving = 'saving',
	Committing = 'committing',
	Deleting = 'deleting'
}

interface NoteStateParams {
	value: NoteState;
	action?: string;
	description: string;
	nextTempState: NoteTempState;
}

export const noteStateLookup: Record<NoteState, NoteStateParams> = {
	[NoteState.Draft]: {
		value: NoteState.Draft,
		description: 'This note will save automatically as a draft transaction.',
		nextTempState: NoteTempState.Saving
	},
	[NoteState.Committed]: {
		value: NoteState.Committed,
		action: 'Commit',
		description: 'This note will be commited to the warehouse. Requires confirmation.',
		nextTempState: NoteTempState.Committing
	},
	[NoteState.Deleted]: {
		value: NoteState.Deleted,
		action: 'Delete',
		description: 'This note will be permanently deleted. Requires confirmation.',
		nextTempState: NoteTempState.Deleting
	}
};

export const noteStates = Object.values(noteStateLookup);
