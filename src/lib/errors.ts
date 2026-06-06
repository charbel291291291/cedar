/** User-facing message; logs technical detail for support. */
export function getErrorMessage(error: unknown, fallback: string): string {
  console.error('[Charbel]', error)
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  return fallback
}
