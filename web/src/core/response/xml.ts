const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/?[^>]+>|[^<]+/g

type Token = { kind: 'open' | 'close' | 'self' | 'other'; text: string; name: string } | { kind: 'text'; text: string; name: '' }

function tokenize(text: string): Token[] {
  return (text.match(TOKEN) ?? []).map((part): Token => {
    if (!part.startsWith('<')) return { kind: 'text', text: part, name: '' }
    if (part.startsWith('<!') || part.startsWith('<?')) return { kind: 'other', text: part, name: '' }
    const name = /^<\/?\s*([^\s/>]+)/.exec(part)?.[1] ?? ''
    if (part.startsWith('</')) return { kind: 'close', text: part, name }
    return { kind: part.endsWith('/>') ? 'self' : 'open', text: part, name }
  })
}

/** Indents an XML document one element per line. Returns null when the tags do not match, so the caller shows
 * the text as it came instead of a misleading layout. Text inside elements is kept, only trimmed. */
export function prettyXml(text: string, indent = '  '): string | null {
  const tokens = tokenize(text.trim())
  const lines: string[] = []
  const stack: string[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const pad = indent.repeat(stack.length)
    if (token.kind === 'text') {
      if (token.text.trim()) lines.push(pad + token.text.trim())
      continue
    }
    if (token.kind === 'close') {
      if (stack.pop() !== token.name) return null
      lines.push(indent.repeat(stack.length) + token.text)
      continue
    }
    if (token.kind === 'open') {
      // <name>short text</name> on one line
      const [next, after] = [tokens[index + 1], tokens[index + 2]]
      if (next?.kind === 'text' && after?.kind === 'close' && after.name === token.name) {
        lines.push(pad + token.text + next.text.trim() + after.text)
        index += 2
        continue
      }
      if (next?.kind === 'close' && next.name === token.name) {
        lines.push(pad + token.text + next.text)
        index += 1
        continue
      }
      lines.push(pad + token.text)
      stack.push(token.name)
      continue
    }
    lines.push(pad + token.text)
  }
  return stack.length === 0 ? lines.join('\n') : null
}
