import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-neutral-200 text-neutral-900',
        secondary: 'bg-neutral-800 text-neutral-300',
        outline: 'border border-neutral-600 text-neutral-400',
        destructive: 'bg-red-950 text-red-400',
        success: 'bg-green-950 text-green-400',
        warning: 'bg-yellow-950 text-yellow-400',
        blue: 'bg-blue-950 text-blue-400',
        purple: 'bg-purple-950 text-purple-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
