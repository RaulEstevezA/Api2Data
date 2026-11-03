import { useI18n } from '../i18n/useI18n.ts'
import { DESKTOP_RELEASED } from '../utils/desktopDownload.ts'
import { API2CLASS_URL, SOURCE_URL, TOOLS_URL } from '../utils/links.ts'
import { DesktopDownload } from './DesktopDownload.tsx'
import './LinksPanel.css'

/** Card under the workspace: desktop download (once released), source code, the other tools and where to take a JSON
 * response next. */
export function LinksPanel() {
  const { t } = useI18n()
  const links = (
    <>
      <a className="button" href={SOURCE_URL} target="_blank" rel="noopener">
        {t.sourceCode}
      </a>
      <a className="button" href={TOOLS_URL}>
        {t.allTools}
      </a>
    </>
  )
  return (
    <section className="links window">
      {DESKTOP_RELEASED ? <DesktopDownload>{links}</DesktopDownload> : <div className="actions">{links}</div>}
      <p className="links__note">
        {t.api2classNote} <a href={API2CLASS_URL}>{t.api2classLink}</a>
      </p>
    </section>
  )
}
