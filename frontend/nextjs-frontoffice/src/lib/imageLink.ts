import { filesApi } from '@/lib/api'

/** True when the browser manages to display `src` as an image (within `timeoutMs`). */
export function loadsAsImage(src: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => { img.src = ''; resolve(false) }, timeoutMs)
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0) }
    img.onerror = () => { clearTimeout(timer); resolve(false) }
    img.referrerPolicy = 'no-referrer'
    img.src = src
  })
}

/**
 * Turn a pasted link into an image URL the site can rely on: the server
 * downloads and stores a copy (Google Drive / Dropbox share links understood).
 * When the remote site refuses our server (422) but the browser can show the
 * link, the link itself is kept (`copied: false`).
 * Throws an Error carrying a user-facing (French) message otherwise.
 */
export async function importImageLink(link: string, folder: string): Promise<{ url: string; copied: boolean }> {
  const raw = link.trim()
  try {
    return { url: await filesApi.importUrl(raw, folder), copied: true }
  } catch (err: any) {
    const data = err?.response?.data
    if (err?.response?.status === 422 && /^https?:\/\//i.test(raw) && await loadsAsImage(raw)) {
      return { url: raw, copied: false }
    }
    throw new Error(data?.message ?? data?.error ?? 'Ce lien n’a pas pu être importé.')
  }
}
