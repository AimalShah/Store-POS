import * as React from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  group: string;
  keywords?: string;
  shortcut?: string;
  onSelect: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const c of commands) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return [...map.entries()];
  }, [commands]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="Search products, pages, actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {groups.map(([group, items], i) => (
            <React.Fragment key={group}>
              {i > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.label} ${c.keywords ?? ''}`}
                    onSelect={() => {
                      onOpenChange(false);
                      c.onSelect();
                    }}
                  >
                    {c.icon}
                    <span>{c.label}</span>
                    {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
