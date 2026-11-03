import type { ReactNode } from 'react'
import './Pane.css'

/** One of the workspace columns: a title bar with actions, an optional row of section tabs, a body that fills the
 * height and an optional footer. */
export function Pane({
  title,
  actions,
  toolbar,
  footer,
  children,
}: {
  title: string
  actions?: ReactNode
  toolbar?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="pane" aria-label={title}>
      <header className="pane__header">
        <h2 className="pane__title">{title}</h2>
        {actions && <div className="pane__actions">{actions}</div>}
      </header>
      {toolbar}
      <div className="pane__body">{children}</div>
      {footer && <footer className="pane__footer">{footer}</footer>}
    </section>
  )
}
