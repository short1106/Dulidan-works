import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'

export type MenuEntry =
  | {
      id: string
      label: string
      onSelect: () => void
      shortcut?: string
      disabled?: boolean
      /** Shows a check mark, for on/off options. */
      checked?: boolean
      icon?: ReactNode
    }
  | { id: string; separator: true }

export interface MenuDefinition {
  id: string
  label: string
  items: MenuEntry[]
}

function isSeparator(entry: MenuEntry): entry is { id: string; separator: true } {
  return 'separator' in entry
}

interface MenuPopupProps {
  items: MenuEntry[]
  labelledBy: string
  onClose: (refocusTrigger: boolean) => void
  /** Moves to the previous or next menu in a menu bar. */
  onNavigate?: (direction: -1 | 1) => void
}

/** The open list of a menu. Arrow keys move, Enter selects, Escape closes. */
function MenuPopup({ items, labelledBy, onClose, onNavigate }: MenuPopupProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()
  }, [])

  function focusables(): HTMLElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"])') ?? []
    )
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const list = focusables()
    const index = list.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        list[(index + 1) % list.length]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        list[(index - 1 + list.length) % list.length]?.focus()
        break
      case 'Home':
        event.preventDefault()
        list[0]?.focus()
        break
      case 'End':
        event.preventDefault()
        list[list.length - 1]?.focus()
        break
      case 'Escape':
        event.preventDefault()
        onClose(true)
        break
      case 'Tab':
        onClose(false)
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (onNavigate) {
          event.preventDefault()
          onNavigate(event.key === 'ArrowRight' ? 1 : -1)
        }
        break
    }
  }

  return (
    <div ref={listRef} role="menu" aria-labelledby={labelledBy} className="dd-menu" onKeyDown={handleKeyDown}>
      {items.map((entry) =>
        isSeparator(entry) ? (
          <div key={entry.id} role="separator" className="dd-menu__separator" />
        ) : (
          <button
            key={entry.id}
            type="button"
            role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={entry.checked}
            aria-disabled={entry.disabled || undefined}
            tabIndex={-1}
            className="dd-menu__item"
            onClick={() => {
              if (entry.disabled) return
              onClose(true)
              entry.onSelect()
            }}
          >
            <span className="dd-menu__check" aria-hidden="true">
              {entry.checked ? '✓' : entry.icon}
            </span>
            <span className="dd-menu__label">{entry.label}</span>
            {entry.shortcut && <span className="dd-menu__shortcut">{entry.shortcut}</span>}
          </button>
        )
      )}
    </div>
  )
}

/** Closes when the user clicks anywhere outside the given element. */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOutside: () => void): void {
  useEffect(() => {
    if (!active) return
    function handle(event: PointerEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside()
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [ref, active, onOutside])
}

export interface MenuBarProps {
  label: string
  menus: MenuDefinition[]
  className?: string
}

/** Classic menu bar (Datei, Bearbeiten, ...) with full keyboard support. */
export function MenuBar({ label, menus, className }: MenuBarProps): React.JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const close = (): void => setOpenIndex(null)
  useClickOutside(barRef, openIndex !== null, close)

  function triggerAt(index: number): HTMLButtonElement | undefined {
    return barRef.current?.querySelectorAll<HTMLButtonElement>('.dd-menubar__trigger')[index]
  }

  function move(from: number, direction: -1 | 1, open: boolean): void {
    const next = (from + direction + menus.length) % menus.length
    triggerAt(next)?.focus()
    setOpenIndex(open ? next : null)
  }

  return (
    <div ref={barRef} role="menubar" aria-label={label} className={cx('dd-menubar', className)}>
      {menus.map((menu, index) => {
        const triggerId = `dd-menubar-${menu.id}`
        const isOpen = openIndex === index
        return (
          <div key={menu.id} className="dd-menubar__entry">
            <button
              id={triggerId}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              className={cx('dd-menubar__trigger', isOpen && 'is-open')}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              onPointerEnter={() => openIndex !== null && setOpenIndex(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setOpenIndex(index)
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault()
                  move(index, event.key === 'ArrowRight' ? 1 : -1, false)
                }
              }}
            >
              {menu.label}
            </button>
            {isOpen && (
              <MenuPopup
                items={menu.items}
                labelledBy={triggerId}
                onNavigate={(direction) => move(index, direction, true)}
                onClose={(refocus) => {
                  close()
                  if (refocus) triggerAt(index)?.focus()
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface DropdownMenuProps {
  /** Content of the trigger button. */
  trigger: ReactNode
  /** Accessible name of the trigger. */
  label: string
  items: MenuEntry[]
  className?: string
  triggerClassName?: string
}

/** A single button that opens a menu below it. */
export function DropdownMenu({ trigger, label, items, className, triggerClassName }: DropdownMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  useClickOutside(rootRef, open, () => setOpen(false))

  return (
    <div ref={rootRef} className={cx('dd-dropdown', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cx('dd-dropdown__trigger', triggerClassName)}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <MenuPopup
          items={items}
          labelledBy={triggerId}
          onClose={(refocus) => {
            setOpen(false)
            if (refocus) triggerRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
