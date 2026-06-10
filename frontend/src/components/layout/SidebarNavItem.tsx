import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  iconOnly: boolean;
  end?: boolean;
}

export function SidebarNavItem({ to, label, icon: Icon, iconOnly, end }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={iconOnly ? label : undefined}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md text-sm transition-colors',
          iconOnly ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
          isActive
            ? 'bg-brand-700 text-white font-medium'
            : 'text-brand-50 hover:bg-brand-600 hover:text-white',
        )
      }
    >
      <Icon size={iconOnly ? 20 : 18} className="shrink-0" />
      {!iconOnly && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

interface SidebarIconButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  iconOnly: boolean;
  children?: React.ReactNode;
}

export function SidebarIconButton({
  label,
  icon: Icon,
  active,
  onClick,
  iconOnly,
  children,
}: SidebarIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={iconOnly ? label : undefined}
      aria-label={label}
      aria-expanded={children ? true : undefined}
      className={cn(
        'flex w-full items-center rounded-md text-sm transition-colors',
        iconOnly ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
        active
          ? 'bg-brand-700 text-white font-medium'
          : 'text-brand-50 hover:bg-brand-600 hover:text-white',
      )}
    >
      <Icon size={iconOnly ? 20 : 18} className="shrink-0" />
      {!iconOnly && <span className="flex-1 truncate text-left">{label}</span>}
      {!iconOnly && children}
    </button>
  );
}
