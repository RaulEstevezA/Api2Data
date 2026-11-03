/** Re-indents valid JSON without parsing its values, so numbers beyond JavaScript's precision
 * (12345678901234567890) and escapes stay exactly as the server sent them. Call it only on valid JSON. */
export function prettyJson(text: string, indent = '  '): string {
  let out = ''
  let depth = 0
  let inString = false
  const newline = () => '\n' + indent.repeat(depth)

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      out += char
      if (char === '\\') out += text[++index] ?? ''
      else if (char === '"') inString = false
      continue
    }
    switch (char) {
      case '"':
        inString = true
        out += char
        break
      case '{':
      case '[': {
        // Empty objects and lists stay on one line
        let next = index + 1
        while (next < text.length && ' \t\n\r'.includes(text[next])) next++
        if (text[next] === (char === '{' ? '}' : ']')) {
          out += char + text[next]
          index = next
        } else {
          depth++
          out += char + newline()
        }
        break
      }
      case '}':
      case ']':
        depth--
        out += newline() + char
        break
      case ',':
        out += ',' + newline()
        break
      case ':':
        out += ': '
        break
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        break
      default:
        out += char
    }
  }
  return out
}
