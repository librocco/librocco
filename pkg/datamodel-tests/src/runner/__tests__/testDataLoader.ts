import { RawBook, RawNote, RawSnap } from '../../types';

import book1 from '../__testData__/books/science/0007149522.json';
import book2 from '../__testData__/books/science/0061983411.json';
import book3 from '../__testData__/books/science/0080524230.json';
import book4 from '../__testData__/books/jazz/0194349276.json';
import book5 from '../__testData__/books/jazz/0195071409.json';
import book6 from '../__testData__/books/jazz/0195399706.json';
import book7 from '../__testData__/books/jazz/019976915X.json';
const scienceBooks = [book1, book2, book3];
const jazzBooks = [book4, book5, book6, book7];
const allBooks = [...scienceBooks, ...jazzBooks];

import note1 from '../__testData__/notes/note-000.json';
import note2 from '../__testData__/notes/note-001.json';
import note3 from '../__testData__/notes/note-002.json';
import note4 from '../__testData__/notes/note-003.json';
import note5 from '../__testData__/notes/note-004.json';
import note6 from '../__testData__/notes/note-005.json';
import note7 from '../__testData__/notes/note-006.json';
import note8 from '../__testData__/notes/note-007.json';
import note9 from '../__testData__/notes/note-008.json';
import note10 from '../__testData__/notes/note-009.json';
const allNotes = [note1, note2, note3, note4, note5, note6, note7, note8, note9, note10];

import snap1 from '../__testData__/snaps/note-000.json';
import snap2 from '../__testData__/snaps/note-001.json';
import snap3 from '../__testData__/snaps/note-002.json';
import snap4 from '../__testData__/snaps/note-003.json';
import snap5 from '../__testData__/snaps/note-004.json';
import snap6 from '../__testData__/snaps/note-005.json';
import snap7 from '../__testData__/snaps/note-006.json';
import snap8 from '../__testData__/snaps/note-007.json';
import snap9 from '../__testData__/snaps/note-008.json';
import snap10 from '../__testData__/snaps/note-009.json';
const allSnaps = [snap1, snap2, snap3, snap4, snap5, snap6, snap7, snap8, snap9, snap10];

// Getters used to pass the module as `TestDataLoader` in runner
export const getBooks = async () => allBooks as RawBook[];
export const getNotes = async () => allNotes as RawNote[];
export const getSnaps = async () => allSnaps as RawSnap[];

// Additional getters for easier unit tests
export const getSnap = (n: number) => allSnaps[n] as RawSnap;
export const getScienceBooks = () => scienceBooks as RawBook[];
export const getJazzBooks = () => jazzBooks as RawBook[];
