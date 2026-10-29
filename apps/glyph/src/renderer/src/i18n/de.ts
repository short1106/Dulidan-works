/**
 * All German UI texts of Glyph. Simple sentences, "du" form.
 * English can be added later as a second file with the same keys.
 */
export const de = {
  app: {
    name: 'Glyph',
    brand: 'Dulidan',
    untitled: 'Unbenannt',
    windowTitle: (title: string, dirty: boolean) => `${dirty ? '• ' : ''}${title} – Dulidan Glyph`
  },

  start: {
    skipHint: 'Klicken oder Taste drücken zum Überspringen'
  },

  modes: {
    chooserTitle: 'Wie möchtest du arbeiten?',
    chooserText: 'Du kannst das später jederzeit in den Einstellungen ändern.',
    basic: {
      name: 'Basis',
      text: 'Große Knöpfe und nur das Wichtigste. Ideal, wenn du einfach schreiben willst.'
    },
    expert: {
      name: 'Experte',
      text: 'Alle Funktionen mit Menüs, Tastenkürzeln, Formatvorlagen und Tabellen.'
    },
    pro: {
      name: 'Pro',
      text: 'Wie Experte, dazu später April, deine KI-Hilfe beim Schreiben.'
    },
    choose: 'Auswählen'
  },

  actions: {
    new: 'Neu',
    open: 'Öffnen',
    save: 'Speichern',
    saveAs: 'Speichern unter …',
    pdf: 'PDF',
    exportPdf: 'Als PDF speichern …',
    print: 'Drucken …',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    bold: 'Fett',
    italic: 'Kursiv',
    underline: 'Unterstrichen',
    heading: 'Überschrift',
    bulletList: 'Liste',
    bulletListLong: 'Aufzählung',
    orderedList: 'Nummerierte Liste',
    image: 'Bild',
    imageLong: 'Bild einfügen …',
    link: 'Link …',
    removeLink: 'Link entfernen',
    alignLeft: 'Linksbündig',
    alignCenter: 'Zentriert',
    alignRight: 'Rechtsbündig',
    alignJustify: 'Blocksatz',
    findReplace: 'Suchen und Ersetzen',
    settings: 'Einstellungen',
    versions: 'Frühere Stände …',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    zoomReset: 'Originalgröße',
    textColor: 'Textfarbe',
    fontFamily: 'Schriftart',
    fontSize: 'Schriftgröße',
    styles: 'Formatvorlage',
    insertTable: 'Tabelle einfügen',
    addRowAfter: 'Zeile darunter einfügen',
    addColumnAfter: 'Spalte rechts einfügen',
    deleteRow: 'Zeile löschen',
    deleteColumn: 'Spalte löschen',
    toggleHeaderRow: 'Kopfzeile an/aus',
    deleteTable: 'Tabelle löschen',
    recentFiles: 'Zuletzt geöffnet',
    noRecentFiles: 'Noch keine Dokumente',
    april: 'April'
  },

  menus: {
    label: 'Hauptmenü',
    file: 'Datei',
    edit: 'Bearbeiten',
    insert: 'Einfügen',
    format: 'Format',
    table: 'Tabelle',
    view: 'Ansicht',
    themeDark: 'Dunkles Thema',
    themeLight: 'Helles Thema'
  },

  toolbar: {
    label: 'Werkzeugleiste'
  },

  styles: {
    paragraph: 'Standard',
    heading1: 'Überschrift 1',
    heading2: 'Überschrift 2',
    heading3: 'Überschrift 3',
    quote: 'Zitat'
  },

  fonts: {
    default: 'Inter (Standard)',
    rajdhani: 'Rajdhani',
    serif: 'Serifenschrift',
    mono: 'Schreibmaschine'
  },

  colors: {
    default: 'Standardfarbe',
    names: ['Schwarz', 'Grau', 'Rot', 'Orange', 'Grün', 'Blau', 'Lila', 'Magenta'] as const
  },

  editor: {
    label: 'Dokument',
    placeholder: 'Hier kannst du schreiben …'
  },

  status: {
    words: (count: number) => (count === 1 ? '1 Wort' : `${count.toLocaleString('de-DE')} Wörter`),
    saved: 'Gespeichert',
    unsaved: 'Nicht gespeichert',
    zoom: 'Zoom'
  },

  find: {
    title: 'Suchen und Ersetzen',
    find: 'Suchen',
    replace: 'Ersetzen durch',
    next: 'Weiter',
    previous: 'Zurück',
    replaceOne: 'Ersetzen',
    replaceAll: 'Alle ersetzen',
    matchCase: 'Groß/klein beachten',
    close: 'Schließen',
    results: (current: number, total: number) => (total === 0 ? 'Keine Treffer' : `${current} von ${total}`),
    replaced: (count: number) => (count === 1 ? '1 Stelle ersetzt' : `${count} Stellen ersetzt`)
  },

  link: {
    title: 'Link einfügen',
    url: 'Adresse (z. B. https://dulidan.de)',
    apply: 'Übernehmen',
    remove: 'Link entfernen',
    invalid: 'Bitte gib eine Adresse ein, die mit https://, http:// oder mailto: beginnt.'
  },

  dialogs: {
    ok: 'OK',
    cancel: 'Abbrechen',
    close: 'Schließen',
    unsavedTitle: 'Änderungen speichern?',
    unsavedText: (title: string) => `Du hast „${title}“ geändert. Möchtest du die Änderungen speichern?`,
    save: 'Speichern',
    dontSave: 'Nicht speichern',
    savedTitle: 'Gespeichert',
    savedText: (name: string, folder: string) => `Dein Dokument „${name}“ ist gespeichert in: ${folder}`,
    showFolder: 'Ordner zeigen',
    pdfSavedText: (name: string, folder: string) => `Die PDF-Datei „${name}“ liegt in: ${folder}`
  },

  folders: {
    documents: 'Dokumente',
    desktop: 'Schreibtisch',
    downloads: 'Downloads'
  },

  recovery: {
    title: 'Dokumente wiederherstellen',
    text: 'Glyph wurde beim letzten Mal nicht richtig beendet. Diese Dokumente waren noch nicht gespeichert:',
    restore: 'Wiederherstellen',
    discard: 'Verwerfen',
    later: 'Alle verwerfen',
    savedAt: (date: string) => `zuletzt gesichert ${date}`
  },

  versions: {
    title: 'Frühere Stände',
    text: 'Glyph sichert dein Dokument alle 30 Sekunden. Hier kannst du zu einem der letzten zehn Stände zurückgehen.',
    empty: 'Noch keine Stände gesichert. Der erste kommt nach 30 Sekunden.',
    restore: 'Diesen Stand laden',
    restored: 'Früherer Stand geladen. Du kannst ihn mit Rückgängig wieder verwerfen.'
  },

  settings: {
    title: 'Einstellungen',
    mode: 'Modus',
    theme: 'Aussehen',
    dark: 'Dunkel',
    light: 'Hell',
    animations: 'Animationen',
    animationsOn: 'An',
    animationsOff: 'Aus',
    animationsHint: 'Wenn dein System „Bewegung reduzieren“ eingestellt hat, bleiben Animationen immer aus.',
    basicFontSize: 'Schriftgröße im Basis-Modus',
    fontNormal: 'Normal',
    fontLarge: 'Groß',
    fontXLarge: 'Sehr groß',
    about: (version: string) => `Dulidan Glyph ${version} · Alle Dokumente bleiben auf deinem Computer.`
  },

  april: {
    title: 'April',
    comingSoon: 'Kommt mit April',
    text: 'April ist die KI-Hilfe von Dulidan Works. Sie hilft dir bald beim Schreiben, Umformulieren und Zusammenfassen.',
    inputPlaceholder: 'Frag April etwas …'
  },

  errors: {
    'not-a-glyph-file': 'Diese Datei ist kein Glyph-Dokument.',
    'newer-version': 'Dieses Dokument wurde mit einer neueren Glyph-Version erstellt. Bitte aktualisiere Glyph, um es zu öffnen.',
    damaged: 'Das Dokument ist beschädigt und kann nicht geöffnet werden.',
    'not-found': 'Die Datei wurde nicht gefunden. Vielleicht wurde sie verschoben oder gelöscht.',
    'not-allowed': 'Auf diese Datei darf Glyph nicht zugreifen.',
    'write-failed': 'Speichern hat nicht geklappt. Prüfe, ob genug Platz frei ist und ob du in diesem Ordner speichern darfst.',
    pdfFailed: 'Die PDF-Datei konnte nicht erstellt werden.',
    printFailed: 'Drucken hat nicht geklappt.',
    imageFailed: 'Das Bild konnte nicht geladen werden.'
  },

  notices: {
    saved: 'Gespeichert',
    pdfSaved: 'PDF gespeichert'
  }
} as const
