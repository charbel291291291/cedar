import { supabase } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function validateServiceImage(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP or GIF images are allowed.')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Image must be smaller than 5 MB.')
  }
}

export async function uploadServiceImage(file: File, serviceId: string): Promise<string> {
  validateServiceImage(file)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${serviceId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('service-images')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from('service-images').getPublicUrl(path)
  return data.publicUrl
}
