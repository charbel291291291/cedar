import { LucideIcon } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ServiceCardProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  imageUrl?: string | null
  onClick: () => void
  className?: string
}

export default function ServiceCard({ title, subtitle, icon: Icon, imageUrl, onClick, className }: ServiceCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onClick()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'glass cursor-pointer transition-all duration-200 border-border/50',
        'hover:border-primary/40 hover:glow hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'shadow-md dark:shadow-black/40',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="font-heading text-lg leading-tight">{title}</CardTitle>
            {subtitle && <CardDescription className="mt-1">{subtitle}</CardDescription>}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
