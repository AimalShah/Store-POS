import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  Check,
  ChevronsUpDown,
  Download,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Printer,
  ReceiptText,
  Search,
  Settings as SettingsIcon,
  ShoppingCart,
  Timer,
  User,
  UserCog,
  Users,
  UtensilsCrossed,
  Warehouse,
  AlertTriangle,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Toaster } from '../components/ui/sonner';
import { Badge } from '../components/ui/badge';
import { applyTheme, isThemeId, DEFAULT_THEME } from '../lib/theme';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../context/AuthContext';
import { useStoreData } from '../hooks/useStoreData';
import { getPosBridge } from '../bridge';
import { getUploadsBase } from '../api/client';
import { buildLogoUrl } from '../lib/branding';
import { buildNavGroups, resolveInitialView, type NavItemId, type Permissions } from '../lib/nav';
import { buildDateRange, type DateRange } from '../lib/dateRange';
import { api, type Transaction } from '../api/client';
import { DateRangePicker, type PickerValue } from '../components/DateRangePicker';
import { CommandPalette, type PaletteCommand } from '../components/CommandPalette';
import { StoreSwitcher, type Outlet } from '../components/StoreSwitcher';
import CatalogView from '../pages/CatalogView';
import CustomersView from '../pages/CustomersView';
import DashboardView from '../pages/DashboardView';
import SettingsView from '../pages/SettingsView';
import ShiftView from '../pages/ShiftView';
import StockHistoryView from '../pages/StockHistoryView';
import TeamView from '../pages/TeamView';
import ReportsView from '../pages/ReportsView';
import ExportView from '../pages/ExportView';
import PrinterSettingsView from '../pages/PrinterSettingsView';
import TransactionsModal from '../components/TransactionsModal';
import TillView from '../pages/TillView';

const ICONS: Record<string, typeof Package> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ReceiptText,
  Users,
  Warehouse,
  Timer,
  UserCog,
  Settings: SettingsIcon,
  Download,
  Printer,
  BarChart3,
};

type Mode = 'till' | 'dashboard';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function ModeSwitcher({
  mode,
  onSelect,
}: {
  mode: Mode;
  onSelect: (m: Mode) => void;
}) {
  const current =
    mode === 'till'
      ? { label: 'Till', icon: <ShoppingCart className="size-4" /> }
      : { label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted">
        {current.icon}
        <span>{current.label}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => onSelect('till')}>
          <ShoppingCart className="size-4" />
          <span>Till</span>
          {mode === 'till' && <Check className="ml-auto size-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect('dashboard')}>
          <LayoutDashboard className="size-4" />
          <span>Dashboard</span>
          {mode === 'dashboard' && <Check className="ml-auto size-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AppShell() {
  const { user, hasPerm, logout } = useAuth();
  const { products, categories, customers, settings, error, reload } = useStoreData();
  const [mode, setMode] = useState<Mode>('till');
  const [holdCount, setHoldCount] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [date, setDate] = useState<PickerValue>({
    preset: 'today',
    range: buildDateRange('today'),
  });
  const [heldOrders, setHeldOrders] = useState<Transaction[]>([]);

  // Confirmation gate for leaving the current mode/screen.
  const pendingAction = useRef<(() => void) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');

  const requestConfirm = useCallback((title: string, message: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMsg(message);
    pendingAction.current = action;
    setConfirmOpen(true);
  }, []);

  // Apply the saved theme preset (or the default) whenever settings load or change.
  useEffect(() => {
    applyTheme(isThemeId(settings?.theme) ? settings.theme : DEFAULT_THEME);
  }, [settings?.theme]);

  const runConfirmed = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setConfirmOpen(false);
    action?.();
  }, []);

  const perms: Permissions = {
    perm_products: hasPerm('perm_products') ? 1 : 0,
    perm_categories: hasPerm('perm_categories') ? 1 : 0,
    perm_transactions: hasPerm('perm_transactions') ? 1 : 0,
    perm_users: hasPerm('perm_users') ? 1 : 0,
    perm_settings: hasPerm('perm_settings') ? 1 : 0,
  };
  const groups = buildNavGroups(perms);
  const [view, setView] = useState<NavItemId>('dashboard');

  const visibleIds = groups.flatMap((g) => g.items.map((i) => i.id));
  const activeView = visibleIds.includes(view) ? view : resolveInitialView(groups);
  const symbol = settings?.symbol || 'Rs';
  const logoUrl = buildLogoUrl(settings?.img, getUploadsBase());
  const storeName = settings?.store || 'Store POS';

  const labelFor = useCallback(
    (id: NavItemId) =>
      groups.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? String(id),
    [groups]
  );

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (p) => p.trackStock && p.quantity <= p.lowStockThreshold
      ).length,
    [products]
  );

  const loadHeld = useCallback(async () => {
    try {
      const held = await api.getOnHold().catch(() => [] as Transaction[]);
      setHeldOrders(held);
      setHoldCount(held.length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadHeld();
    const id = setInterval(() => void loadHeld(), 30_000);
    return () => clearInterval(id);
  }, [loadHeld]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const switchMode = useCallback(
    (target: Mode) => {
      if (target === mode) return;
      requestConfirm(
        target === 'till' ? 'Switch to the Till?' : 'Switch to the Dashboard?',
        target === 'till'
          ? 'This leaves the management dashboard. The till will open for a new sale.'
          : 'The current till view will be hidden. Any in-progress order will be parked.',
        () => setMode(target)
      );
    },
    [mode, requestConfirm]
  );

  const goTo = useCallback(
    (v: NavItemId) => {
      if (mode === 'dashboard') {
        setView(v);
        return;
      }
      requestConfirm(
        'Leave the till?',
        `You'll switch to the management dashboard and open ${labelFor(v)}. Any in-progress order will be parked.`,
        () => {
          setMode('dashboard');
          setView(v);
        }
      );
    },
    [mode, requestConfirm, labelFor]
  );

  const outlets: Outlet[] = useMemo(
    () => [{ id: 'main', name: storeName, logoUrl }],
    [storeName, logoUrl]
  );

  const commands: PaletteCommand[] = useMemo(() => {
    const nav: PaletteCommand[] = groups.flatMap((g) =>
      g.items.map((item) => ({
        id: `nav-${item.id}`,
        label: item.label,
        group: g.label,
        icon: (() => {
          const Icon = ICONS[item.icon] ?? Package;
          return <Icon className="size-4 text-muted-foreground" />;
        })(),
        onSelect: () => goTo(item.id),
      }))
    );
    const actions: PaletteCommand[] = [
      {
        id: 'new-sale',
        label: 'New Sale',
        group: 'Actions',
        icon: <PlusCircle className="size-4 text-muted-foreground" />,
        shortcut: 'N',
        onSelect: () => setMode('till'),
      },
      {
        id: 'refresh',
        label: 'Refresh data',
        group: 'Actions',
        icon: <BarChart3 className="size-4 text-muted-foreground" />,
        onSelect: () => reload(),
      },
    ];
    const productCmds: PaletteCommand[] = products.slice(0, 40).map((p) => ({
      id: `product-${p._id}`,
      label: p.name,
      group: 'Products',
      keywords: `product sku ${p.category}`,
      icon: <Package className="size-4 text-muted-foreground" />,
      onSelect: () => goTo('catalog'),
    }));
    return [...nav, ...actions, ...productCmds];
  }, [groups, products, reload, goTo]);

  function renderView() {
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardView
            settings={settings}
            range={date.range}
            onQuickSale={() => setMode('till')}
            onHeldClick={() => goTo('sales')}
            onLowStockClick={() => goTo('catalog')}
          />
        );
      case 'catalog':
        return (
          <CatalogView
            products={products}
            categories={categories}
            symbol={symbol}
            canProducts={hasPerm('perm_products')}
            canCategories={hasPerm('perm_categories')}
            onChanged={reload}
          />
        );
      case 'sales':
        return (
          <TransactionsModal
            embedded
            open
            symbol={symbol}
            settings={settings}
            onClose={() => setView('dashboard')}
          />
        );
      case 'customers':
        return <CustomersView customers={customers} onChanged={reload} />;
      case 'stock-history':
        return <StockHistoryView products={products} symbol={symbol} />;
      case 'shifts':
        return <ShiftView settings={settings} onShiftChange={reload} />;
      case 'reports':
        return <ReportsView symbol={symbol} />;
      case 'team':
        return <TeamView />;
      case 'settings':
        return <SettingsView settings={settings} onSaved={reload} />;
      case 'export':
        return <ExportView />;
      case 'printers':
        return <PrinterSettingsView />;
      default:
        return null;
    }
  }

  function UserMenu() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-full border px-1 pr-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted">
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-primary">
              {user ? initials(user.fullname) : 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{user?.fullname}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex flex-col px-2 py-1.5 text-xs font-medium">
            <span>{user?.fullname}</span>
            <span className="font-normal text-muted-foreground">@{user?.username}</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => goTo('settings')}>
            <User className="size-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goTo('settings')}>
            <SettingsIcon className="size-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => getPosBridge().quit()}
          >
            <Home className="size-4" /> Quit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function HeldBell() {
    return (
      <Popover>
        <PopoverTrigger className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted">
          <Bell className="size-4" />
          {heldOrders.length > 0 && (
            <Badge className="absolute -top-1 -right-1 size-4 justify-center rounded-full p-0 text-[10px]">
              {heldOrders.length}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="flex items-center justify-between">
            <p className="font-medium">Held orders</p>
            <Badge variant="secondary">{heldOrders.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Orders parked at the till, waiting to resume.
          </p>
          {heldOrders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No held orders.</p>
          ) : (
            <ul className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-auto">
              {heldOrders.map((o) => (
                <li key={o._id}>
                  <button
                    type="button"
                    onClick={() => setMode('till')}
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="truncate">{o.customer_name || 'Walk-in'}</span>
                    <span className="font-medium">{symbol}{Number(o.total || 0).toFixed(2)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  function TopBar() {
    return (
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        {mode === 'dashboard' && <SidebarTrigger />}

        <ModeSwitcher mode={mode} onSelect={switchMode} />

        {mode === 'dashboard' && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <DateRangePicker value={date} onChange={setDate} />
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-4" />
            <span className="hidden md:inline">Search</span>
            <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground md:inline">
              ⌘K
            </kbd>
          </Button>

          <HeldBell />

          {lowStockCount > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-amber-600 hover:text-amber-700"
              title={`${lowStockCount} products low on stock`}
              onClick={() => goTo('catalog')}
            >
              <AlertTriangle className="size-4" />
            </Button>
          )}

          <Button size="sm" onClick={() => setMode('till')}>
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">New Sale</span>
          </Button>

          <UserMenu />
        </div>
      </header>
    );
  }

  if (mode === 'till') {
    return (
      <div className="flex h-screen flex-col bg-background">
        <TopBar />
        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">
          <TillView
            products={products}
            categories={categories}
            customers={customers}
            settings={settings}
            holdCount={holdCount}
            onHoldCount={setHoldCount}
            onRefresh={reload}
          />
        </main>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
        <Toaster />

        <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmMsg}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={runConfirmed}>Switch</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <StoreSwitcher outlets={outlets} activeId="main" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2 pt-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Quick New Order"
                onClick={() => setMode('till')}
                className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                size="lg"
              >
                <UtensilsCrossed />
                <span>Quick New Order</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel className="px-2 uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = ICONS[item.icon] ?? Package;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeView === item.id}
                          onClick={() => goTo(item.id)}
                          tooltip={item.label}
                          className="data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)] data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <TopBar />
        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full overflow-auto p-6">{renderView()}</div>
        </main>
      </SidebarInset>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
      <Toaster />

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
