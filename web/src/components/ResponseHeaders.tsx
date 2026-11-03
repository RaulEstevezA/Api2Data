import { useI18n } from '../i18n/useI18n.ts'
import './ResponseHeaders.css'

export function ResponseHeaders({ headers }: { headers: readonly [string, string][] }) {
  const { t } = useI18n()
  return (
    <div className="response-headers">
      {headers.length === 0 ? (
        <p className="response-headers__note">{t.noHeaders}</p>
      ) : (
        <div className="response-headers__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.headerName}</th>
                <th scope="col">{t.headerValue}</th>
              </tr>
            </thead>
            <tbody>
              {headers.map(([name, value], index) => (
                <tr key={`${name}-${index}`}>
                  <td>{name}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="response-headers__note">{t.exposedHeadersNote}</p>
    </div>
  )
}
