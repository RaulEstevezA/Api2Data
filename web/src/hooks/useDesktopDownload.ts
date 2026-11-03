import { useEffect, useState } from 'react'
import { detectArchitecture, detectPlatform, hasArchitectureChoice, type Architecture } from '../utils/desktopDownload.ts'

const platform = detectPlatform(navigator)

/** The visitor's system and processor, from the browser's own information: nothing is asked to GitHub until a
 * download link is clicked. */
export function useDesktopDownload() {
  // x64 until the browser says otherwise; the note always links the other one in case it guessed wrong
  const [architecture, setArchitecture] = useState<Architecture>('x64')
  const choice = platform !== null && hasArchitectureChoice(platform)

  useEffect(() => {
    if (!choice) return
    let active = true
    void detectArchitecture(navigator).then((detected) => {
      if (active && detected) setArchitecture(detected)
    })
    return () => {
      active = false
    }
  }, [choice])

  return { platform, architecture, choice, otherArchitecture: (architecture === 'x64' ? 'arm64' : 'x64') as Architecture }
}
