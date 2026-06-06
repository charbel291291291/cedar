import { supabase } from '@/lib/supabase'

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs'
export const MAX_PROOF_BYTES = 5 * 1024 * 1024

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function validateProofFile(file: File): void {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('Image must be 5MB or smaller.')
  }
}

export type ProofUploadFolder = 'topups' | 'orders'

/**
 * Storage path: `{userId}/{folder}/{timestamp}.{ext}` — first segment must equal `auth.uid()` (RLS).
 * Returns object storage path (not a public URL). Use `getPaymentProofSignedUrl` to display.
 */
export async function uploadPaymentProof(
  file: File,
  userId: string,
  folder: ProofUploadFolder
): Promise<{ path: string }> {
  validateProofFile(file)
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${userId}/${folder}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(PAYMENT_PROOFS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return { path }
}

const PUBLIC_URL_HINT = '/storage/v1/object/public/payment-proofs/'

/** Resolve a stored path or legacy public URL to a time-limited signed URL. */
export async function getPaymentProofSignedUrl(pathOrUrl: string | null, ttlSec = 3600): Promise<string | null> {
  if (!pathOrUrl?.trim()) return null
  const raw = pathOrUrl.trim()
  if (/^https?:\/\//i.test(raw)) {
    const idx = raw.indexOf(PUBLIC_URL_HINT)
    if (idx === -1) return raw
    const objectPath = decodeURIComponent(raw.slice(idx + PUBLIC_URL_HINT.length))
    const { data, error } = await supabase.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .createSignedUrl(objectPath, ttlSec)
    if (error) throw error
    return data.signedUrl
  }
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(raw, ttlSec)
  if (error) throw error
  return data.signedUrl
}
