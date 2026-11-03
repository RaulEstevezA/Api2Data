/** "512 B", "2.3 KB", "1.4 MB", with the language's decimal separator. */
export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes.toLocaleString(locale)} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`
}

/** "142 ms" below a second, "1.24 s" above. */
export function formatDuration(ms: number, locale: string): string {
  if (ms < 1000) return `${ms.toLocaleString(locale)} ms`
  return `${(ms / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} s`
}

/** Host of an address, to name it in messages; the address itself when it cannot be read. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
