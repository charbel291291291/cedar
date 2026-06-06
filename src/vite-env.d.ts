/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Prefer this name (matches Supabase dashboard “anon public”). */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Lovable / older templates use this name — same value as the anon key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
