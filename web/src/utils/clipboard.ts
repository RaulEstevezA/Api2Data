/** Copies text; returns false when the browser refuses (the text stays selectable, so no error is shown). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
