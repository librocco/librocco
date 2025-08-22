import { NoteState, NoteTempState } from "@librocco/shared";

interface NoteStateParams {
	value: NoteState;
	action?: string;
	description: string;
	tempState: NoteTempState;
}

export const noteStateLookup: Record<NoteState, NoteStateParams> = {
	[NoteState.Draft]: {
		value: NoteState.Draft,
		description: "This note will save automatically as a draft transaction.",
		tempState: NoteTempState.Saving
	},
	[NoteState.Committed]: {
		value: NoteState.Committed,
		action: "Commit",
		description: "This note will be commited to the warehouse. Requires confirmation.",
		tempState: NoteTempState.Committing
	},
	[NoteState.Deleted]: {
		value: NoteState.Deleted,
		action: "Delete",
		description: "This note will be permanently deleted. Requires confirmation.",
		tempState: NoteTempState.Deleting
	}
};

export const formats = ["PBM", "Standard", "RCS-3", "RCS-5", "Loescher-3", "Loescher-5"];

export const noteStates = Object.values(noteStateLookup);
