// Browser mirror of api/_lib/describeChanges.js — the server computes the
// authoritative summary at publish time for the stored activity log; this
// copy lets the dashboard feed update instantly after saving (Blob storage
// has read-after-write lag, so a refetch would show a stale feed).
type Content = Record<string, any>

export function describeChanges(before: Content | null, after: Content): string {
  if (!before) return 'First publish'
  const changes: string[] = []

  if (before.hero && after.hero) {
    const heroKeys = [
      'tag', 'headlineTop', 'headlineAccent', 'headlineBottom', 'intro',
      'primaryCta', 'secondaryCta', 'videoCaption', 'videoCoords', 'videoUrl', 'posterUrl',
    ]
    const changed = heroKeys.filter((k) => (before.hero[k] ?? '') !== (after.hero[k] ?? ''))
    if (changed.length) changes.push(`Hero — ${changed.length} field${changed.length > 1 ? 's' : ''} updated`)
  }

  const listChanges = (name: string, beforeList: unknown, afterList: unknown) => {
    const b = Array.isArray(beforeList) ? beforeList : []
    const a = Array.isArray(afterList) ? afterList : []
    if (a.length !== b.length) {
      const diff = a.length - b.length
      changes.push(`${name} — ${diff > 0 ? `${diff} added` : `${-diff} removed`} (${b.length} → ${a.length})`)
      return
    }
    const edits = a.reduce((n, item, i) => (JSON.stringify(item) !== JSON.stringify(b[i]) ? n + 1 : n), 0)
    if (edits) changes.push(`${name} — ${edits} edited`)
  }

  listChanges('Services', before.services, after.services)
  listChanges('Projects', before.projects, after.projects)
  listChanges('About images', before.aboutImages, after.aboutImages)

  const pagesBefore = before.pages ?? {}
  const pagesAfter = after.pages ?? {}
  const pageEdits = Object.keys(pagesAfter).filter(
    (k) => JSON.stringify(pagesAfter[k]) !== JSON.stringify(pagesBefore[k]),
  )
  if (pageEdits.length) changes.push(`Section copy — ${pageEdits.join(', ')}`)

  if (JSON.stringify(before.stats ?? []) !== JSON.stringify(after.stats ?? [])) {
    changes.push('Hero stats updated')
  }
  if (JSON.stringify(before.company ?? {}) !== JSON.stringify(after.company ?? {})) {
    changes.push('Company details updated')
  }

  if (!changes.length) return 'Republished without content changes'
  return changes.slice(0, 4).join(' · ') + (changes.length > 4 ? ` +${changes.length - 4} more` : '')
}
