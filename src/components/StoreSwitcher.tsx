import { Check, ChevronsUpDown, Store as StoreIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export type Outlet = { id: string; name: string; logoUrl?: string | null };

export function StoreSwitcher({
  outlets,
  activeId,
  onSwitch,
}: {
  outlets: Outlet[];
  activeId: string;
  onSwitch?: (id: string) => void;
}) {
  const active = outlets.find((o) => o.id === activeId) ?? outlets[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/switcher flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-sidebar-accent">
        <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {active.logoUrl ? (
            <img src={active.logoUrl} alt="" className="size-5 rounded object-contain" />
          ) : (
            <StoreIcon className="size-4" />
          )}
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate font-semibold">{active.name}</span>
          <span className="truncate text-xs text-muted-foreground">Main outlet</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-[--anchor-width] min-w-56"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Outlets
        </div>
        <DropdownMenuSeparator />
        {outlets.map((o) => (
          <DropdownMenuItem
            key={o.id}
            className={cn('gap-2')}
            onClick={() => onSwitch?.(o.id)}
          >
            <div className="flex aspect-square size-5 items-center justify-center rounded bg-primary/10 text-primary">
              {o.logoUrl ? (
                <img src={o.logoUrl} alt="" className="size-3.5 rounded object-contain" />
              ) : (
                <StoreIcon className="size-3" />
              )}
            </div>
            <span className="flex-1 truncate">{o.name}</span>
            {o.id === active.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
