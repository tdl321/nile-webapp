import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon'
  className?: string
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
}

export function Logo({ size = 'md', variant = 'full', className }: LogoProps) {
  const height = sizeMap[size]

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/nilelogo.svg"
        alt="Nile Logo"
        width={Math.floor(height * 1.5)}
        height={height}
        priority
        className="object-contain shrink-0"
        style={{ display: 'block' }}
      />
      {variant === 'full' && (
        <span className="text-2xl font-bold">Nile</span>
      )}
    </div>
  )
}
