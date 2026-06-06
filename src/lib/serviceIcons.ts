import {
  BookOpen,
  CreditCard,
  Gamepad2,
  type LucideIcon,
  Music,
  Package,
  Smartphone,
  Sparkles,
  Tv,
  Zap,
} from 'lucide-react'

const FALLBACK: LucideIcon[] = [Smartphone, Gamepad2, Tv, CreditCard, Sparkles, Package, Zap, Music, BookOpen]

/** Pick a stable icon from service name (and row index as fallback). */
export function serviceIconFor(name: string, index: number): LucideIcon {
  const n = name.toLowerCase()
  if (/(pubg|game|play|steam|xbox)/i.test(n)) return Gamepad2
  if (/(netflix|tv|stream|shahid)/i.test(n)) return Tv
  if (/(music|spotify|apple|sound)/i.test(n)) return Music
  if (/(book|kindle|read)/i.test(n)) return BookOpen
  if (/(phone|mobile|sim|cell)/i.test(n)) return Smartphone
  if (/(card|pay|credit|visa)/i.test(n)) return CreditCard
  if (/(gift|star|diamond|premium)/i.test(n)) return Sparkles
  return FALLBACK[index % FALLBACK.length]
}
