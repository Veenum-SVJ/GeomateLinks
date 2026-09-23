// Human-readable summary of what changed between two published content
// documents. Runs server-side at publish time so the dashboard activity feed
// can show "what changed" without shipping content history to the browser.
export function describeChanges(before, after) {
  if (!before) return 'First publish'
  const changes = []

  if (before.hero && after.hero) {
    const heroKeys = [
      'tag', 'headlineTop', 'headlineAccent', 'headlineBottom', 'intro',
      'primaryCta', 'secondaryCta', 'videoCaption', 'videoCoords', 'videoUrl', 'posterUrl',
    ]
    const changed = heroKeys.filter((k) => (before.hero[k] ?? '') !== (after.hero[k] ?? ''))
    if (changed.length) changes.push(`Hero — ${changed.length} field${changed.length > 1 ? 's' : ''} updated`)
  }

  const listChanges = (name, beforeList, afterList) => {
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
