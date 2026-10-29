/**
 * All German UI texts of Cortex. Simple sentences, "du" form.
 */
export const de = {
  app: {
    name: 'Cortex',
    windowTitle: (title: string | null) => (title ? `${title} – Dulidan Cortex` : 'Dulidan Cortex'),
    skipHint: 'Klicken oder Taste drücken zum Überspringen'
  },

  modes: {
    chooserTitle: 'Wie möchtest du arbeiten?',
    chooserText: 'Du kannst das später jederzeit in den Einstellungen ändern.',
    choose: 'Auswählen',
    basic: { name: 'Basis', text: 'Große Knöpfe und bunte Zettel: Notizen schreiben, Checklisten, Bilder und Suchen.' },
    expert: { name: 'Experte', text: 'Alles: Ordner, Schlagwörter, Verknüpfungen, Tabellen, Export und die Schnellnotiz.' },
    pro: { name: 'Pro', text: 'Wie Experte, dazu später April, deine KI-Hilfe für Notizen.' }
  },

  nav: {
    label: 'Bereiche',
    all: 'Alle Notizen',
    pinned: 'Angeheftet',
    folders: 'Ordner',
    tags: 'Schlagwörter',
    trash: 'Papierkorb',
    newNote: 'Neue Notiz',
    newFolder: 'Neuer Ordner',
    settings: 'Einstellungen',
    import: 'Importieren',
    back: 'Alle Notizen',
    layoutList: 'Als Liste zeigen',
    layoutCards: 'Als Karten zeigen',
    folderActions: (name: string) => `Aktionen für Ordner ${name}`,
    renameFolder: 'Ordner umbenennen',
    removeFolder: 'Ordner löschen',
    subfolder: 'Unterordner anlegen',
    topLevel: 'Oberste Ebene'
  },

  list: {
    label: 'Notizen',
    empty: 'Hier sind noch keine Notizen.',
    emptyBasic: 'Noch keine Notizen. Klicke auf „Neue Notiz“, um zu beginnen.',
    noResults: 'Nichts gefunden.',
    searchPlaceholder: 'Notizen durchsuchen',
    searchResults: (count: number) => (count === 1 ? '1 Treffer' : `${count} Treffer`),
    pinned: 'angeheftet',
    tasks: (done: number, total: number) => `${done} von ${total} erledigt`,
    emptyNote: 'Leere Notiz',
    changed: (date: string) => `Geändert ${date}`
  },

  note: {
    titleLabel: 'Titel der Notiz',
    textLabel: 'Text der Notiz',
    placeholder: 'Schreib los …',
    pin: 'Anheften',
    unpin: 'Nicht mehr anheften',
    color: 'Farbe',
    colorNames: { gelb: 'Gelb', gruen: 'Grün', blau: 'Blau', rosa: 'Rosa', lila: 'Lila', orange: 'Orange' } as Record<string, string>,
    noColor: 'Keine Farbe',
    trash: 'In den Papierkorb',
    trashed: (title: string) => `„${title}“ liegt jetzt im Papierkorb.`,
    more: 'Weitere Aktionen',
    exportPdf: 'Als PDF speichern',
    exportMarkdown: 'Als Markdown speichern',
    exported: 'Gespeichert',
    move: 'In Ordner verschieben',
    moved: (folder: string) => `Verschoben nach „${folder}“.`,
    rename: 'Umbenennen',
    renamedLinks: (count: number) => (count === 1 ? 'Eine Verknüpfung in einer anderen Notiz wurde angepasst.' : `${count} Verknüpfungen in anderen Notizen wurden angepasst.`),
    tags: 'Schlagwörter',
    addTag: 'Schlagwort hinzufügen',
    removeTag: (tag: string) => `Schlagwort ${tag} entfernen`,
    backlinks: 'Diese Notizen verlinken hierher',
    noBacklinks: 'Noch keine Notiz verlinkt hierher. Schreibe [[ und den Titel in eine andere Notiz.',
    saving: 'Wird gespeichert …',
    saved: (time: string) => `Gespeichert um ${time} Uhr`,
    unsaved: 'Nicht gespeichert',
    select: 'Wähle links eine Notiz aus oder lege eine neue an.',
    folderIn: (folder: string) => `Ordner: ${folder}`,
    linkHint: 'Strg + Klick öffnet',
    conflictTitle: 'Notiz wurde woanders geändert',
    conflictText:
      'Diese Notiz wurde außerhalb von Cortex geändert, während du geschrieben hast (zum Beispiel von einem anderen Programm). Welche Fassung möchtest du behalten?',
    keepMine: 'Meine Fassung behalten',
    loadTheirs: 'Andere Fassung laden',
    removedTitle: 'Notiz nicht mehr da',
    removedText: 'Diese Notiz wurde außerhalb von Cortex gelöscht oder verschoben. Deinen Text kann Cortex als neue Notiz speichern.',
    keepAsNew: 'Als neue Notiz speichern',
    discard: 'Verwerfen'
  },

  editor: {
    toolbar: 'Formatierung',
    paragraph: 'Normaler Text',
    heading: (level: number) => `Überschrift ${level}`,
    headingMenu: 'Textart',
    bold: 'Fett',
    italic: 'Kursiv',
    bulletList: 'Liste',
    orderedList: 'Nummerierte Liste',
    taskList: 'Checkliste',
    quote: 'Zitat',
    code: 'Code',
    codeBlock: 'Code-Block',
    link: 'Link',
    linkAddress: 'Adresse des Links',
    linkApply: 'Übernehmen',
    linkRemove: 'Link entfernen',
    image: 'Bild einfügen',
    attachment: 'Datei anhängen',
    wikiLink: 'Notiz verknüpfen',
    table: 'Tabelle',
    tableInsert: 'Tabelle einfügen',
    tableRowAfter: 'Zeile darunter einfügen',
    tableColumnAfter: 'Spalte rechts einfügen',
    tableRowDelete: 'Zeile löschen',
    tableColumnDelete: 'Spalte löschen',
    tableDelete: 'Tabelle löschen',
    imageError: 'Das Bild konnte nicht eingefügt werden.',
    tooBig: 'Die Datei ist größer als 50 MB und wurde nicht eingefügt.',
    suggestions: 'Vorschläge für Verknüpfungen',
    noSuggestion: (text: string) => `Neue Notiz „${text}“ verknüpfen`,
    openLinkTitle: 'Link öffnen?',
    openLinkText: (url: string) => `Dieser Link öffnet sich im Browser:\n\n${url}`,
    openLink: 'Öffnen',
    openAttachmentTitle: 'Anhang öffnen?',
    openAttachmentText: (name: string) => `Die Datei „${name}“ öffnet sich mit dem passenden Programm auf deinem Computer.`,
    attachmentBlocked: 'Diese Datei könnte ein Programm starten und wird deshalb nicht geöffnet.',
    attachmentMissing: 'Die Datei wurde im Ordner „attachments“ nicht gefunden.',
    missingNoteTitle: 'Notiz anlegen?',
    missingNoteText: (title: string) => `Es gibt noch keine Notiz „${title}“. Möchtest du sie jetzt anlegen?`,
    create: 'Anlegen'
  },

  trash: {
    title: 'Papierkorb',
    info: 'Notizen bleiben 30 Tage im Papierkorb. Danach kannst du sie endgültig löschen.',
    empty: 'Der Papierkorb ist leer.',
    restore: 'Wiederherstellen',
    restored: (title: string) => `„${title}“ ist wieder da.`,
    deleteForGood: 'Endgültig löschen',
    daysLeft: (days: number) => (days === 1 ? 'Noch 1 Tag im Papierkorb' : `Noch ${days} Tage im Papierkorb`),
    canDelete: 'Kann endgültig gelöscht werden',
    from: (place: string) => `Vorher in: ${place}`,
    deleteTitle: 'Endgültig löschen?',
    deleteText: (title: string) => `„${title}“ wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.`,
    expiredTitle: 'Papierkorb aufräumen?',
    expiredText: (count: number) =>
      count === 1
        ? 'Eine Notiz liegt seit über 30 Tagen im Papierkorb. Möchtest du sie endgültig löschen?'
        : `${count} Notizen liegen seit über 30 Tagen im Papierkorb. Möchtest du sie endgültig löschen?`,
    keep: 'Behalten',
    deleted: 'Endgültig gelöscht'
  },

  folders: {
    newTitle: 'Neuer Ordner',
    renameTitle: 'Ordner umbenennen',
    name: 'Name des Ordners',
    create: 'Anlegen',
    save: 'Umbenennen',
    notEmpty: 'Der Ordner enthält noch Notizen oder Dateien. Verschiebe sie zuerst.',
    exists: 'Einen Ordner mit diesem Namen gibt es hier schon.',
    removeTitle: 'Ordner löschen?',
    removeText: (name: string) => `Der leere Ordner „${name}“ wird gelöscht.`,
    moveTitle: 'In Ordner verschieben',
    moveText: 'Wohin soll die Notiz?',
    moveAction: 'Verschieben'
  },

  importExport: {
    imported: (count: number) => (count === 1 ? 'Eine Notiz importiert.' : `${count} Notizen importiert.`),
    nothing: 'Es wurden keine Markdown- oder Textdateien gewählt.'
  },

  quick: {
    title: 'Schnellnotiz',
    hint: 'Landet im Ordner „Posteingang“.',
    titleLabel: 'Titel (freiwillig)',
    textLabel: 'Notiz',
    save: 'Speichern',
    cancel: 'Abbrechen',
    discard: 'Verwerfen',
    discardText: 'Die Schnellnotiz ist noch nicht gespeichert. Möchtest du sie verwerfen?',
    saved: 'Schnellnotiz gespeichert',
    empty: 'Schreib zuerst etwas in die Notiz.'
  },

  recovery: {
    title: 'Ungespeicherte Notizen gefunden',
    text: (titles: string) => `Cortex wurde nicht richtig beendet. Diese Notizen hatten noch ungespeicherte Änderungen: ${titles}. Möchtest du sie wiederherstellen?`,
    restore: 'Wiederherstellen',
    discard: 'Verwerfen',
    restored: 'Ungespeicherte Änderungen wiederhergestellt.'
  },

  settings: {
    title: 'Einstellungen',
    mode: 'Modus',
    theme: 'Aussehen',
    dark: 'Dunkel',
    light: 'Hell',
    animations: 'Animationen',
    on: 'An',
    off: 'Aus',
    basicFontSize: 'Schriftgröße im Basis-Modus',
    fontNormal: 'Normal',
    fontLarge: 'Groß',
    fontXLarge: 'Sehr groß',
    notesFolder: 'Notizordner',
    notesFolderHint: 'Jede Notiz ist eine normale Datei in diesem Ordner. Du kannst ihn mit jedem Backup sichern.',
    chooseFolder: 'Anderen Ordner wählen',
    showFolder: 'Ordner öffnen',
    folderChanged: 'Neuer Notizordner geöffnet.',
    rebuild: 'Suchindex neu aufbauen',
    rebuildHint: 'Nur nötig, wenn die Suche etwas nicht findet. Deine Notizen bleiben unverändert.',
    rebuilt: (count: number) => `Suchindex neu aufgebaut: ${count} Notizen.`,
    quickNote: 'Schnellnotiz',
    quickNoteInfo: (keys: string) => `Mit ${keys} öffnet sich überall ein kleines Fenster für eine schnelle Notiz, solange Cortex geöffnet ist.`,
    quickNoteBusy: (keys: string) => `Das Tastenkürzel ${keys} wird gerade von einem anderen Programm benutzt.`,
    about: (version: string) => `Dulidan Cortex ${version} · Deine Notizen bleiben auf deinem Computer.`
  },

  april: {
    title: 'April',
    comingSoon: 'Kommt mit April',
    text: 'April ist die KI-Hilfe von Dulidan Works. Sie kann bald Notizen zusammenfassen und alte Notizen wiederfinden. In dieser Version sendet April nichts und verschickt keine Daten.',
    summarize: 'Notiz zusammenfassen',
    findOld: 'Ähnliche Notizen finden'
  },

  errors: {
    'not-found': 'Die Notiz wurde nicht gefunden. Vielleicht wurde sie außerhalb von Cortex verschoben.',
    'invalid-path': 'Dieser Name oder Ort ist nicht erlaubt.',
    'folder-not-empty': 'Der Ordner ist nicht leer.',
    exists: 'Das gibt es hier schon.',
    'too-early': 'Notizen können erst nach 30 Tagen im Papierkorb endgültig gelöscht werden.',
    conflict: 'Die Notiz wurde woanders geändert.',
    'too-big': 'Die Datei ist zu groß (höchstens 50 MB).',
    unknown: 'Das hat nicht geklappt. Bitte versuche es noch einmal.'
  } as Record<string, string>,

  dialogs: {
    ok: 'OK',
    cancel: 'Abbrechen',
    close: 'Schließen'
  }
}
