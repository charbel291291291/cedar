import { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'splash';
}

const sizeMap: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
  splash: 'w-20 h-20 sm:w-24 sm:h-24',
};

export function BrandLogo({ size = 'md', className, ...props }: BrandLogoProps) {
  return (
    <img
      src="/assets/cedar1.png"
      alt="Cedar Boost Logo"
      className={cn(
        'object-contain shrink-0 transition-all duration-300',
        sizeMap[size],
        className
      )}
      loading="eager"
      {...props}
    />
  );
}
