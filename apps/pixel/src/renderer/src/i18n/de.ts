/**
 * All German UI texts of Pixel. Simple sentences, "du" form.
 * English can be added later as a second file with the same keys.
 */
export const de = {
  app: {
    name: 'Pixel',
    untitled: 'Unbenannt',
    windowTitle: (title: string, dirty: boolean) => `${dirty ? '• ' : ''}${title} – Dulidan Pixel`,
    skipHint: 'Klicken oder Taste drücken zum Überspringen'
  },

  modes: {
    chooserTitle: 'Wie möchtest du arbeiten?',
    chooserText: 'Du kannst das später jederzeit in den Einstellungen ändern.',
    choose: 'Auswählen',
    basic: { name: 'Basis', text: 'Große Knöpfe und nur das Wichtigste. Ideal, wenn du einfach malen willst.' },
    expert: { name: 'Experte', text: 'Alle Werkzeuge mit Ebenen, Farbwähler, Zuschneiden und Größe ändern.' },
    pro: { name: 'Pro', text: 'Wie Experte, dazu später April, deine KI-Hilfe für Bilder.' }
  },

  tools: {
    label: 'Werkzeuge',
    brush: 'Pinsel',
    pen: 'Stift',
    eraser: 'Radierer',
    fill: 'Füllen',
    shapes: 'Formen',
    text: 'Text',
    picker: 'Pipette',
    crop: 'Zuschneiden'
  },

  options: {
    label: 'Werkzeug-Einstellungen',
    size: 'Größe',
    lineWidth: 'Strichstärke',
    hardness: 'Härte',
    opacity: 'Deckkraft',
    smoothing: 'Glättung',
    tolerance: 'Toleranz',
    filled: 'Gefüllt',
    line: 'Linie',
    rectangle: 'Rechteck',
    ellipse: 'Ellipse',
    fontSize: 'Schriftgröße',
    font: 'Schriftart',
    bold: 'Fett',
    pickerHint: 'Klicke ins Bild, um eine Farbe aufzunehmen.',
    cropHint: 'Ziehe einen Rahmen über den Teil, der bleiben soll.',
    applyCrop: 'Zuschneiden',
    cancel: 'Abbrechen',
    textHint: 'Klicke ins Bild und schreibe los.',
    textDone: 'Fertig',
    px: (value: number) => `${value} px`,
    percent: (value: number) => `${Math.round(value)} %`
  },

  fonts: {
    inter: 'Inter',
    rajdhani: 'Rajdhani',
    serif: 'Serifenschrift',
    mono: 'Schreibmaschine'
  },

  color: {
    label: 'Farbe',
    current: 'Aktuelle Farbe',
    hex: 'Farbcode',
    hue: 'Farbton',
    field: 'Sättigung und Helligkeit',
    palette: 'Palette',
    recent: 'Zuletzt benutzt',
    noRecent: 'Noch keine',
    more: 'Mehr Farben …',
    names: [
      'Schwarz', 'Dunkelgrau', 'Grau', 'Weiß', 'Rot', 'Orange', 'Gelb', 'Grün',
      'Türkis', 'Blau', 'Dunkelblau', 'Lila', 'Magenta', 'Rosa', 'Braun', 'Hautfarbe'
    ]
  },

  layers: {
    title: 'Ebenen',
    background: 'Hintergrund',
    layer: (n: number) => `Ebene ${n}`,
    add: 'Neue Ebene',
    remove: 'Ebene löschen',
    up: 'Nach oben',
    down: 'Nach unten',
    show: 'Einblenden',
    hide: 'Ausblenden',
    opacity: 'Deckkraft',
    rename: 'Umbenennen',
    lastLayer: 'Die letzte Ebene kann nicht gelöscht werden.',
    hiddenLayer: 'Diese Ebene ist ausgeblendet. Blende sie ein, um darauf zu malen.'
  },

  actions: {
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    new: 'Neu …',
    open: 'Öffnen …',
    save: 'Speichern',
    saveAs: 'Speichern unter …',
    saveImage: 'Als Bild speichern',
    exportPng: 'Als PNG speichern …',
    exportJpg: 'Als JPG speichern …',
    resize: 'Größe ändern …',
    crop: 'Zuschneiden',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    zoomFit: 'Einpassen',
    zoom100: 'Originalgröße (100 %)',
    settings: 'Einstellungen',
    noRecentFiles: 'Noch keine Dateien'
  },

  history: {
    brush: 'Pinsel',
    eraser: 'Radierer',
    fill: 'Füllen',
    shape: 'Form',
    text: 'Text',
    addLayer: 'Neue Ebene',
    removeLayer: 'Ebene löschen',
    moveLayer: 'Ebene verschieben',
    layerVisibility: 'Ebene ein/aus',
    layerOpacity: 'Deckkraft',
    rename: 'Umbenennen',
    crop: 'Zuschneiden',
    resize: 'Größe ändern'
  },

  menus: {
    label: 'Hauptmenü',
    file: 'Datei',
    edit: 'Bearbeiten',
    image: 'Bild',
    layer: 'Ebene',
    view: 'Ansicht',
    themeDark: 'Dunkles Thema',
    themeLight: 'Helles Thema'
  },

  newCanvas: {
    title: 'Neues Bild',
    presets: 'Vorlage',
    width: 'Breite (px)',
    height: 'Höhe (px)',
    background: 'Hintergrund',
    white: 'Weiß',
    transparent: 'Durchsichtig',
    color: 'Farbe',
    create: 'Erstellen',
    presetNames: {
      screen: 'Bildschirm (1920 × 1080)',
      square: 'Quadrat (1080 × 1080)',
      a4: 'A4 Hochformat (2480 × 3508)',
      postcard: 'Postkarte (1748 × 1240)',
      custom: 'Eigene Größe'
    },
    tooBig: (max: number) => `Höchstens ${max} Pixel pro Seite.`
  },

  resize: {
    title: 'Größe ändern',
    width: 'Breite (px)',
    height: 'Höhe (px)',
    keepRatio: 'Seitenverhältnis beibehalten',
    apply: 'Ändern',
    current: (w: number, h: number) => `Jetzt: ${w} × ${h} Pixel`
  },

  status: {
    size: (w: number, h: number) => `${w} × ${h} px`,
    position: (x: number, y: number) => `${x}, ${y}`,
    zoom: 'Zoom',
    saved: 'Gespeichert',
    unsaved: 'Nicht gespeichert',
    panHint: 'Leertaste halten und ziehen zum Verschieben'
  },

  dialogs: {
    ok: 'OK',
    cancel: 'Abbrechen',
    close: 'Schließen',
    save: 'Speichern',
    dontSave: 'Nicht speichern',
    unsavedTitle: 'Änderungen speichern?',
    unsavedText: (title: string) => `Du hast „${title}“ geändert. Möchtest du die Änderungen speichern?`,
    savedTitle: 'Gespeichert',
    savedText: (name: string, folder: string) => `Dein Bild „${name}“ ist gespeichert in: ${folder}`,
    showFolder: 'Ordner zeigen',
    imageFormatTitle: 'Als Bild speichern',
    imageFormatText: 'PNG behält durchsichtige Stellen und ist verlustfrei. JPG ist kleiner und passt gut für Fotos.'
  },

  folders: {
    documents: 'Dokumente',
    desktop: 'Schreibtisch',
    downloads: 'Downloads',
    pictures: 'Bilder'
  },

  recovery: {
    title: 'Bilder wiederherstellen',
    text: 'Pixel wurde beim letzten Mal nicht richtig beendet. Diese Bilder waren noch nicht gespeichert:',
    restore: 'Wiederherstellen',
    discard: 'Verwerfen',
    discardAll: 'Alle verwerfen',
    savedAt: (date: string) => `zuletzt gesichert ${date}`
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
    animationsHint: 'Wenn dein System „Bewegung reduzieren“ eingestellt hat, bleiben Animationen immer aus.',
    basicFontSize: 'Schriftgröße im Basis-Modus',
    fontNormal: 'Normal',
    fontLarge: 'Groß',
    fontXLarge: 'Sehr groß',
    about: (version: string) => `Dulidan Pixel ${version} · Alle Bilder bleiben auf deinem Computer.`
  },

  april: {
    title: 'April',
    comingSoon: 'Kommt mit April',
    text: 'April ist die KI-Hilfe von Dulidan Works. Hier kann sie bald Bilder für dich bearbeiten.',
    removeBackground: 'Hintergrund entfernen',
    upscale: 'Bild vergrößern'
  },

  errors: {
    'not-a-pixel-file': 'Diese Datei ist kein Pixel-Projekt.',
    'newer-version': 'Dieses Projekt wurde mit einer neueren Pixel-Version erstellt. Bitte aktualisiere Pixel.',
    damaged: 'Die Datei ist beschädigt und kann nicht geöffnet werden.',
    'not-found': 'Die Datei wurde nicht gefunden. Vielleicht wurde sie verschoben oder gelöscht.',
    'not-allowed': 'Auf diese Datei darf Pixel nicht zugreifen.',
    unsupported: 'Dieses Dateiformat kann Pixel nicht öffnen. Möglich sind .pixel, PNG und JPG.',
    'write-failed': 'Speichern hat nicht geklappt. Prüfe, ob genug Platz frei ist und ob du in diesem Ordner speichern darfst.',
    imageFailed: 'Das Bild konnte nicht geladen werden.',
    exportFailed: 'Das Bild konnte nicht gespeichert werden.'
  },

  notices: {
    saved: 'Gespeichert',
    exported: 'Bild gespeichert'
  }
} as const
