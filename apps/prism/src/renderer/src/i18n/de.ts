/** All texts of Dulidan Prism. Plain German, short sentences. */
export const de = {
  app: { name: 'Dulidan Prism', skipHint: 'Klick oder Taste zum Überspringen' },
  nav: { edit: 'Bearbeiten', present: 'Vorführen', settings: 'Einstellungen' },
  modes: {
    chooserTitle: 'Wie möchtest du arbeiten?',
    chooserText: 'Das kannst du später in den Einstellungen ändern.',
    choose: 'Auswählen',
    basic: { name: 'Basis', text: 'Große Schrift, nur Folien und Vorführen.' },
    expert: { name: 'Experte', text: 'Alle Funktionen, ohne KI.' },
    pro: { name: 'Pro', text: 'Wie Experte, mit April als Helfer (kommt später).' }
  },
  file: {
    new: 'Neu',
    open: 'Öffnen',
    save: 'Speichern',
    saveAs: 'Speichern unter',
    pdf: 'Als PDF speichern',
    unsaved: 'Nicht gespeichert',
    untitled: 'Ohne Namen',
    discardTitle: 'Ungespeicherte Änderungen?',
    discardText: 'Die Änderungen sind noch nicht in einer Datei. Wenn du jetzt weitermachst, gehen sie verloren.',
    discardOk: 'Verwerfen',
    keep: 'Abbrechen',
    recoveryTitle: 'Wiederherstellen?',
    recoveryText: 'Prism hat eine nicht gespeicherte Präsentation gefunden. Soll ich sie wiederherstellen?',
    recoveryOk: 'Wiederherstellen',
    recoveryNo: 'Verwerfen',
    pdfSaved: 'PDF gespeichert.'
  },
  editor: {
    title: 'Präsentation',
    slides: 'Folien',
    add: 'Neue Folie',
    addTitle: 'Titelfolie',
    duplicate: 'Kopieren',
    remove: 'Löschen',
    up: 'Nach oben',
    down: 'Nach unten',
    slideTitle: 'Titel',
    body: 'Text (eine Zeile pro Punkt, "- " für einen Aufzählungspunkt)',
    layout: 'Layout',
    layoutTitle: 'Titelfolie',
    layoutContent: 'Inhaltsfolie',
    deckTitle: 'Name der Präsentation',
    empty: 'Noch keine Folien.',
    slideNumber: (n: number, total: number) => `Folie ${n} von ${total}`
  },
  present: {
    title: 'Vorführen',
    start: 'Vorführung starten',
    next: 'Weiter',
    previous: 'Zurück',
    exit: 'Beenden',
    hint: 'Pfeiltasten oder Leertaste zum Weiterblättern, Esc zum Beenden.'
  },
  settings: {
    title: 'Einstellungen',
    appearance: 'Anzeige',
    mode: 'Modus',
    theme: 'Farben',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    animations: 'Kleine Animationen'
  },
  notices: { close: 'Schließen', error: 'Das hat nicht geklappt.' }
} as const
