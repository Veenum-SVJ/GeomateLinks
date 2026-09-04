import { put, list, del } from '@vercel/blob'

const CONTENT_KEY = 'cms/content.json'
const MESSAGES_KEY = 'cms/messages.json'

async function readJsonBlob<T>(key: string): Promise<T | null> {
  const { blobs } = await list({ prefix: key, limit: 1 })
  const blob = blobs.find((item) => item.pathname === key)
  if (!blob) return null

  const res = await fetch(`${blob.url}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as T
}

async function writeJsonBlob(key: string, data: unknown): Promise<string> {
  const { url } = await put(key, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
  return url
}

export async function getContent<T = Record<string, unknown>>(): Promise<T | null> {
  return readJsonBlob<T>(CONTENT_KEY)
}

export async function saveContent(data: unknown): Promise<string> {
  return writeJsonBlob(CONTENT_KEY, data)
}

export type StoredMessage = {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  createdAt: string
  read: boolean
}

export async function getMessages(): Promise<StoredMessage[]> {
  const data = await readJsonBlob<StoredMessage[]>(MESSAGES_KEY)
  return Array.isArray(data) ? data : []
}

export async function saveMessages(messages: StoredMessage[]): Promise<void> {
  await writeJsonBlob(MESSAGES_KEY, messages)
}

export type MediaItem = {
  pathname: string
  url: string
  size: number
  uploadedAt: string
}

export async function listMedia(): Promise<MediaItem[]> {
  const { blobs } = await list({ prefix: 'media/', limit: 1000 })
  return blobs
    .map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      size: blob.size,
      uploadedAt: typeof blob.uploadedAt === 'string' ? blob.uploadedAt : new Date(blob.uploadedAt).toISOString(),
    }))
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
}

export async function deleteMedia(url: string): Promise<void> {
  await del(url)
}
