// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider.tsx'

/** In-memory Web Storage: Node 25 has its own experimental localStorage that hides jsdom's. */
function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true })
  // CodeMirror measures the layout, which jsdom does not do
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  localStorage.setItem('api2data.language', 'en')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  )
}

describe('App', () => {
  it('sends the request and shows the response', async () => {
    const fetchMock = vi.fn(
      async () => new Response('{"id":1,"name":"Api2Class"}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'GET a repository' }))
    const url = screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement
    expect(url.value).toBe('https://api.github.com/repos/RaulEstevezA/Api2Class')

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('200 OK')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/RaulEstevezA/Api2Class',
      expect.objectContaining({ method: 'GET', credentials: 'omit', headers: [['Accept', 'application/vnd.github+json']] }),
    )
    expect(screen.getByText('application/json')).toBeTruthy()
    // The editor gets its text in an effect after the summary is shown
    await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toContain('"name": "Api2Class"'))
  })

  it('keeps the URL and the Params table in sync', () => {
    renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://api.example.com/items?page=2' } })
    expect((screen.getByRole('textbox', { name: 'Key of row 1' }) as HTMLInputElement).value).toBe('page')

    fireEvent.change(screen.getByRole('textbox', { name: 'Key of row 2' }), { target: { value: 'size' } })
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://api.example.com/items?page=2&size=')
  })

  it('explains a request the browser blocked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://api.example.com/private' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('No response could be read')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('CORS')
  })

  it('does not send without an address', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Write the address of the API to send the request.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps sent requests in the history, without credentials unless chosen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })),
    )
    renderApp()
    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: 'https://api.example.com/items?page=1' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Authorization' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'bearer' } })
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'secret-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('History (1)')).toBeTruthy())

    const stored = localStorage.getItem('api2data.history')!
    expect(stored).toContain('https://api.example.com/items?page=1')
    expect(stored).not.toContain('secret-token')

    // Start over and load it back
    fireEvent.change(screen.getByRole('textbox', { name: 'URL' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load GET https://api.example.com/items?page=1' }))
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://api.example.com/items?page=1')

    // Chosen explicitly: the token is kept, and the entry says so
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also save tokens, passwords and keys' }))
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'secret-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByText('with credentials')).toBeTruthy())
    expect(localStorage.getItem('api2data.history')).toContain('secret-token')

    // Turning it off removes them again
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also save tokens, passwords and keys' }))
    expect(localStorage.getItem('api2data.history')).not.toContain('secret-token')
  })

  it('fills the request from a pasted cURL command', () => {
    renderApp()
    const command =
      "curl 'https://api.example.com/items' \\\n  -H 'accept: application/json' \\\n  -H 'authorization: Bearer abc' \\\n  --data-raw '{\"a\":1}'"
    fireEvent.paste(screen.getByRole('textbox', { name: 'URL' }), { clipboardData: { getData: () => command } })
    expect((screen.getByRole('textbox', { name: 'URL' }) as HTMLInputElement).value).toBe('https://api.example.com/items')
    expect((screen.getByRole('combobox', { name: 'Method' }) as HTMLSelectElement).value).toBe('POST')
    expect(screen.getByText('cURL command imported.')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Authorization/ }).textContent).toContain('Bearer Token')
    expect(screen.getByRole('tab', { name: /Body/ }).textContent).toContain('JSON')
  })
})
