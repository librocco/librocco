import { RawNote, RawSnap } from '@test-runner/types';

import note1 from '@unit-test-data/notes/note-000.json';
import note2 from '@unit-test-data/notes/note-001.json';
import note3 from '@unit-test-data/notes/note-002.json';
const allNotes = [note1, note2, note3];

import snap1 from '@unit-test-data/snaps/note-000.json';
import snap2 from '@unit-test-data/snaps/note-001.json';
import snap3 from '@unit-test-data/snaps/note-002.json';
const allSnaps = [snap1, snap2, snap3];

// Getters used to pass the module as `TestDataLoader` in runner
export const getNotes = async () => allNotes as RawNote[];
export const getSnaps = async () => allSnaps as RawSnap[];
