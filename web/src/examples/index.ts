import { defaultAuth } from '../core/auth/registry.ts'
import { defaultBody } from '../core/body/registry.ts'
import type { RequestDraft } from '../core/http/types.ts'
import { newRowId } from '../app/draft.ts'

export type ExampleId = 'github' | 'query' | 'post'

/** Public APIs that allow requests from any website (CORS), so the examples work from the browser.
 * Nothing is sent until the user presses Send. */
export const EXAMPLES: { id: ExampleId; draft: () => RequestDraft }[] = [
  {
    id: 'github',
    draft: () => ({
      method: 'GET',
      url: 'https://api.github.com/repos/RaulEstevezA/Api2Class',
      params: [],
      headers: [{ id: newRowId(), key: 'Accept', value: 'application/vnd.github+json', enabled: true }],
      auth: defaultAuth(),
      body: defaultBody(),
    }),
  },
  {
    id: 'query',
    draft: () => ({
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/comments?postId=1',
      params: [],
      headers: [],
      auth: defaultAuth(),
      body: defaultBody(),
    }),
  },
  {
    id: 'post',
    draft: () => ({
      method: 'POST',
      url: 'https://jsonplaceholder.typicode.com/posts',
      params: [],
      headers: [],
      auth: defaultAuth(),
      body: {
        ...defaultBody(),
        mode: 'json',
        text: { json: '{\n  "title": "Api2Data",\n  "body": "Sent from the browser",\n  "userId": 1\n}', text: '', xml: '' },
      },
    }),
  },
]
