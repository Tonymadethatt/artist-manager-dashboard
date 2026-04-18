/** Returns true if setting `folderId`'s parent to `newParentId` would create a cycle. */
export function wouldCreateFolderCycle(
  folders: { id: string; parent_id: string | null }[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) return false
  if (newParentId === folderId) return true
  const byId = new Map(folders.map(f => [f.id, f]))
  let walk: string | null = newParentId
  while (walk) {
    if (walk === folderId) return true
    walk = byId.get(walk)?.parent_id ?? null
  }
  return false
}

/** Ancestors from root → … → direct parent (excludes `folderId`). */
export function folderAncestorChain(
  folders: { id: string; parent_id: string | null }[],
  folderId: string,
): { id: string; parent_id: string | null }[] {
  const byId = new Map(folders.map(f => [f.id, f]))
  const chain: { id: string; parent_id: string | null }[] = []
  let walk: string | null = byId.get(folderId)?.parent_id ?? null
  while (walk) {
    const row = byId.get(walk)
    if (!row) break
    chain.unshift(row)
    walk = row.parent_id
  }
  return chain
}

/** Folder id and all nested child folder ids (includes `rootId`). */
export function collectFolderSubtreeIds(
  folders: { id: string; parent_id: string | null }[],
  rootId: string,
): Set<string> {
  const byParent = new Map<string | null, string[]>()
  for (const f of folders) {
    const k = f.parent_id
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(f.id)
  }
  const out = new Set<string>()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    out.add(id)
    for (const c of byParent.get(id) ?? []) stack.push(c)
  }
  return out
}

/** Breadcrumb order: root link + ancestors + current (each with id + name). */
export function folderBreadcrumbItems(
  folders: { id: string; name: string; parent_id: string | null }[],
  currentFolderId: string | null,
): { id: string | null; name: string }[] {
  if (currentFolderId === null) return [{ id: null, name: 'Documents' }]
  const byId = new Map(folders.map(f => [f.id, f]))
  const chain: { id: string | null; name: string }[] = [{ id: null, name: 'Documents' }]
  const ancestors = folderAncestorChain(folders, currentFolderId)
  for (const a of ancestors) {
    const row = byId.get(a.id)
    if (row) chain.push({ id: row.id, name: row.name })
  }
  const cur = byId.get(currentFolderId)
  if (cur) chain.push({ id: cur.id, name: cur.name })
  return chain
}

/** Single-line path for search results (e.g. "Documents / A / B"). */
export function folderDisplayPath(
  folders: { id: string; name: string; parent_id: string | null }[],
  folderId: string | null,
): string {
  const items = folderBreadcrumbItems(folders, folderId)
  return items.map(i => i.name).join(' / ')
}

export function flatFolderPickList(
  folders: { id: string; name: string; parent_id: string | null }[],
  omitIds?: Set<string>,
): { id: string | null; label: string }[] {
  const visible = omitIds ? folders.filter(f => !omitIds.has(f.id)) : folders
  const byParent = new Map<string | null, typeof visible>()
  for (const f of visible) {
    const k = f.parent_id
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(f)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  const out: { id: string | null; label: string }[] = [{ id: null, label: 'Documents (root)' }]
  function walk(parentId: string | null, prefix: string) {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ id: f.id, label: `${prefix}${f.name}` })
      walk(f.id, `${prefix}${f.name} / `)
    }
  }
  walk(null, '')
  return out
}
