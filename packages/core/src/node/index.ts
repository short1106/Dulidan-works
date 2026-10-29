/** File access helpers for the Electron main process (Node only). */
export { atomicWriteFile } from './atomicWrite'
export { SnapshotStore, type SnapshotMeta, type RecoverableDocument } from './snapshotStore'
export { JsonFile } from './jsonFile'
export { openDatabase, transaction, type Database } from './sqlite'
