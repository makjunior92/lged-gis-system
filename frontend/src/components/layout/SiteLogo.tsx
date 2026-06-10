import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
}

export default function SiteLogo({ size = 'md', className }: Props) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}govt-logo.png`}
      alt=""
      className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
      aria-hidden
    />
  );
}
