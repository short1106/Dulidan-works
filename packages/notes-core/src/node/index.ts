/** File access for notes (Electron main process / Node only). */
export { Vault, VaultError, type FileStamp, type LoadedNote, type NewNote } from './vault'
export { NoteIndex, type ListFilter, type SearchHit, type SyncResult } from './noteIndex'
export { NotesService, type NotesServiceOptions, type RenameResult, type SaveInput, type SavedNote } from './service'
export { watchFolder } from './watcher'
