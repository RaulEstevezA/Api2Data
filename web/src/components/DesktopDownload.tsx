import type { ReactNode } from 'react'
import { useDesktopDownload } from '../hooks/useDesktopDownload.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { downloadUrl, RELEASES_URL, type Architecture } from '../utils/desktopDownload.ts'
import './DesktopDownload.css'

const ARCHITECTURE_NAMES: Record<Architecture, string> = { x64: 'x64', arm64: 'ARM64' }

/** "Download for macOS" for the visitor's system, or the releases page when it cannot be told (phones, tablets),
 * with the note about the unsigned app and links to the other builds. Other buttons can share its row. */
export function DesktopDownload({ primary = false, children }: { primary?: boolean; children?: ReactNode }) {
  const { t } = useI18n()
  const { platform, architecture, choice, otherArchitecture } = useDesktopDownload()
  const className = `button${primary ? ' button--primary' : ''}`

  return (
    <div className="desktop-download">
      <div className="actions">
        {platform ? (
          <a className={className} href={downloadUrl(platform, architecture)}>
            {t.downloadFor(architecture === 'arm64' && choice ? `${platform} ${ARCHITECTURE_NAMES.arm64}` : platform)}
          </a>
        ) : (
          <a className={className} href={RELEASES_URL} target="_blank" rel="noopener">
            {t.downloadDesktop}
          </a>
        )}
        {children}
      </div>
      <p className="desktop-download__note">
        {t.downloadNote}{' '}
        <a href={t.howToOpenUrl} target="_blank" rel="noopener">
          {t.howToOpen}
        </a>
        {platform && choice && (
          <>
            {' · '}
            <a href={downloadUrl(platform, otherArchitecture)}>{t.otherArchitecture(ARCHITECTURE_NAMES[otherArchitecture])}</a>
          </>
        )}
        {platform && (
          <>
            {' · '}
            <a href={RELEASES_URL} target="_blank" rel="noopener">
              {t.otherPlatforms}
            </a>
          </>
        )}
      </p>
    </div>
  )
}
