import type { KeyboardEvent } from 'react'
import './SectionTabs.css'

export interface SectionTab<T extends string> {
  id: T
  label: string
  /** Short count or state next to the label ("2", "Bearer") */
  badge?: string
  /** Shown as a warning (a problem inside the section) */
  warning?: boolean
}

/** Row of tabs that changes the section shown inside a pane, as the file tabs of Api2Class. Arrow keys move
 * between tabs. */
export function SectionTabs<T extends string>({
  label,
  tabs,
  selected,
  onSelect,
  idPrefix,
}: {
  label: string
  tabs: readonly SectionTab<T>[]
  selected: T
  onSelect: (id: T) => void
  idPrefix: string
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onSelect(next.id)
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus()
  }

  return (
    <div className="section-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          className="section-tabs__tab"
          aria-selected={tab.id === selected}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={tab.id === selected ? 0 : -1}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
          {tab.badge && <span className={`section-tabs__badge${tab.warning ? ' section-tabs__badge--warning' : ''}`}>{tab.badge}</span>}
        </button>
      ))}
    </div>
  )
}
