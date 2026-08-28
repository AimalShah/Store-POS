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
  Calculator,
  Globe,
} from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { UpdateIndicator } from '../components/UpdateIndicator';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { useStoreData } from '../hooks/useStoreData';
import { getPosBridge } from '../bridge';
import { getUploadsBase } from '../api/client';
import { buildLogoUrl } from '../lib/branding';
import { buildNavGroups, canAccess, resolveInitialView, type NavItemId } from '../lib/nav';
import { buildDateRange, type DateRange } from '../lib/dateRange';
import { api, type Transaction, DrawerSession, type Settings } from '../api/client';
import { isLowStock } from '../lib/stock';
import { DateRangePicker, type PickerValue } from '../components/DateRangePicker';
import { CommandPalette, type PaletteCommand } from '../components/CommandPalette';
import { StoreSwitcher, type Outlet } from '../components/StoreSwitcher';
import CatalogView from '../pages/CatalogView';
import CustomersView from '../pages/CustomersView';
import DashboardView from '../pages/DashboardView';
import ShiftSummaryView from '../pages/ShiftSummaryView';
import SettingsView from '../pages/SettingsView';
import TeamView from '../pages/TeamView';
import ReportsView from '../pages/ReportsView';
import DrawerView from '../pages/DrawerView';
import ExportView from '../pages/ExportView';
import PrinterSettingsView from '../pages/PrinterSettingsView';
import AuditLogView from '../pages/AuditLogView';
import SalesView from '../pages/SalesView';
import StockView from '../pages/StockView';
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
  const { t } = useLocale();
  const current =
    mode === 'till'
      ? { label: t('mode.till'), icon: <ShoppingCart className="size-4" /> }
      : { label: t('mode.dashboard'), icon: <LayoutDashboard className="size-4" /> };
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
          <span>{t('mode.till')}</span>
          {mode === 'till' && <Check className="ml-auto size-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect('dashboard')}>
          <LayoutDashboard className="size-4" />
          <span>{t('mode.dashboard')}</span>
          {mode === 'dashboard' && <Check className="ml-auto size-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Landing({
  storeName,
  logoUrl,
  onChoose,
}: {
  storeName: string;
  logoUrl?: string;
  onChoose: (m: Mode) => void;
}) {
  const { t } = useLocale();
  const options: {
    mode: Mode;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      mode: 'dashboard',
      title: t('mode.dashboard'),
      description: t('shell.dashboard.desc'),
      icon: <LayoutDashboard className="size-6" />,
    },
    {
      mode: 'till',
      title: t('shell.till.title'),
      description: t('shell.till.desc'),
      icon: <ShoppingCart className="size-6" />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-10 flex flex-col items-center text-center">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="mb-4 h-14 w-14 rounded-lg object-contain"
          />
        )}
        <h1 className="font-heading text-2xl font-semibold">{storeName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('shell.whereToGo')}
        </p>
      </div>
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            onClick={() => onChoose(opt.mode)}
            className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-6 text-left shadow-sm outline-none transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {opt.icon}
            </span>
            <span className="font-heading text-lg font-semibold">{opt.title}</span>
            <span className="text-sm text-muted-foreground">{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppShell() {
  const { user, hasRole, logout } = useAuth();
  const { t } = useLocale();
  const { products, categories, customers, settings, error, loading, reload } = useStoreData();
  const [mode, setMode] = useState<Mode>('till');
  const [landed, setLanded] = useState(false);

  const enterMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setLanded(true);
    },
    []
  );
  const [holdCount, setHoldCount] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [date, setDate] = useState<PickerValue>({
    preset: 'today',
    range: buildDateRange('today'),
  });
  const [heldOrders, setHeldOrders] = useState<Transaction[]>([]);
  const [salesInitialStatus, setSalesInitialStatus] = useState<string>('all');
  const [salesInitialUserId, setSalesInitialUserId] = useState<number>(0);
  const [salesInitialVoidFilter, setSalesInitialVoidFilter] = useState<boolean>(false);
  const [stockFilter, setStockFilter] = useState<'low' | 'out' | null>(null);
  const [drawerSession, setDrawerSession] = useState<DrawerSession | null>(null);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');

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

  const role = user?.role ?? 'Cashier';
  const groups = buildNavGroups(role);
  const [view, setView] = useState<NavItemId>('dashboard');

  const visibleIds = groups.flatMap((g) => g.items.map((i) => i.id));
  const activeView = visibleIds.includes(view) ? view : resolveInitialView(groups);

  // Reset sales initial status when navigating away from sales view
  useEffect(() => {
    if (activeView !== 'sales') {
      setSalesInitialStatus('all');
      setSalesInitialUserId(0);
    }
  }, [activeView]);

  // Reset void filter when navigating away from sales view
  useEffect(() => {
    if (activeView !== 'sales') {
      setSalesInitialVoidFilter(false);
    }
  }, [activeView]);

  // Reset stock filter when navigating away from stock view
  useEffect(() => {
    if (activeView !== 'stock') {
      setStockFilter(null);
    }
  }, [activeView]);
  const symbol = settings?.symbol || 'Rs';
  const logoUrl = buildLogoUrl(settings?.img, getUploadsBase());
  const storeName = settings?.store || 'Store POS';

  const labelFor = useCallback(
    (id: NavItemId) => t(`nav.${id}`),
    [t]
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

  const loadDrawerSession = useCallback(async () => {
    try {
      const sessions = await api.getDrawerSessions({ status: 'open', till: settings?.till || 1 });
      const open = sessions[0] ?? null;
      setDrawerSession(open);
    } catch {
      /* ignore */
    }
  }, [settings?.till]);

  const handleCloseDrawer = async () => {
    if (!drawerSession) return;
    const cash = parseFloat(countedCash);
    if (isNaN(cash) || cash < 0) {
      return;
    }
    try {
      await api.closeDrawerSession(drawerSession.id, { countedCash: cash });
      setDrawerSession(null);
      setCloseDrawerOpen(false);
      setCountedCash('');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadHeld();
    void loadDrawerSession();
    const id = setInterval(() => {
      void loadHeld();
      void loadDrawerSession();
    }, 30_000);
    return () => clearInterval(id);
  }, [loadHeld, loadDrawerSession]);

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
        target === 'till'
          ? t('shell.switchToTill')
          : t('shell.switchToDashboard'),
        target === 'till'
          ? t('shell.switchToTillDesc')
          : t('shell.switchToDashboardDesc'),
        () => setMode(target)
      );
    },
    [mode, requestConfirm, t]
  );

  const goTo = useCallback(
    (v: NavItemId) => {
      if (!canAccess(role, v)) return;
      if (mode === 'dashboard') {
        setView(v);
        return;
      }
      requestConfirm(
        t('shell.leaveTill'),
        t('shell.leaveTillDesc', { view: labelFor(v) }),
        () => {
          setMode('dashboard');
          setView(v);
        }
      );
    },
    [mode, requestConfirm, labelFor, role, t]
  );

  const goToSalesWithUserId = useCallback(
    (userId?: number) => {
      if (userId) setSalesInitialUserId(userId);
      if (mode === 'dashboard') {
        setView('sales');
        return;
      }
      requestConfirm(
        t('shell.leaveTill'),
        t('shell.leaveTillDesc', { view: t('nav.sales') }),
        () => {
          setMode('dashboard');
          setView('sales');
        }
      );
    },
    [mode, requestConfirm, t]
  );

  const goToSalesWithVoidFilter = useCallback(
    () => {
      setSalesInitialVoidFilter(true);
      setSalesInitialStatus('2');
      if (mode === 'dashboard') {
        setView('sales');
        return;
      }
      requestConfirm(
        t('shell.leaveTill'),
        t('shell.leaveTillDesc', { view: t('nav.sales') }),
        () => {
          setMode('dashboard');
          setView('sales');
        }
      );
    },
    [mode, requestConfirm, t]
  );

  const outlets: Outlet[] = useMemo(
    () => [{ id: 'main', name: storeName, logoUrl }],
    [storeName, logoUrl]
  );

  const commands: PaletteCommand[] = useMemo(() => {
    const nav: PaletteCommand[] = groups.flatMap((g) =>
      g.items.map((item) => ({
        id: `nav-${item.id}`,
        label: t(`nav.${item.id}`),
        group: t(`nav.group.${g.id}`),
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
        label: t('cmd.newSale'),
        group: t('cmd.actions'),
        icon: <PlusCircle className="size-4 text-muted-foreground" />,
        shortcut: 'N',
        onSelect: () => setMode('till'),
      },
      {
        id: 'refresh',
        label: t('cmd.refreshData'),
        group: t('cmd.actions'),
        icon: <BarChart3 className="size-4 text-muted-foreground" />,
        onSelect: () => reload(),
      },
    ];
    const productCmds: PaletteCommand[] = products.slice(0, 40).map((p) => ({
      id: `product-${p._id}`,
      label: p.name,
      group: t('catalog.products'),
      keywords: `product sku ${p.category}`,
      icon: <Package className="size-4 text-muted-foreground" />,
      onSelect: () => goTo('menu'),
    }));
    return [...nav, ...actions, ...productCmds];
  }, [groups, products, reload, goTo, t]);

  function renderView() {
    switch (activeView) {
      case 'shift-summary':
        return (
          <ShiftSummaryView
            settings={settings}
            range={date.range}
            onNewSale={() => setMode('till')}
            onHeldOrders={() => goTo('sales')}
            onEndShift={() => goTo('drawer')}
          />
        );
      case 'dashboard':
        return (
          <DashboardView
            settings={settings}
            range={date.range}
            onQuickSale={() => setMode('till')}
            onHeldClick={() => goTo('sales')}
            onVoidClick={goToSalesWithVoidFilter}
            onSalesClick={() => goTo('sales')}
            onStockClick={(filter) => {
              setStockFilter(filter);
              goTo('stock');
            }}
            onReportsClick={() => goTo('reports')}
            onDrawerClick={() => goTo('drawer')}
          />
        );
      case 'menu':
        return (
          <CatalogView
            products={products}
            categories={categories}
            symbol={symbol}
            canProducts={hasRole('Admin', 'Manager')}
            canCategories={hasRole('Admin', 'Manager')}
            onChanged={reload}
            loading={loading}
          />
        );
      case 'sales':
        return (
          <SalesView
            symbol={symbol}
            settings={settings}
            onClose={() => {
              setSalesInitialStatus('all');
              setSalesInitialUserId(0);
              setSalesInitialVoidFilter(false);
              setView('dashboard');
            }}
            initialStatus={salesInitialStatus}
            initialUserId={salesInitialUserId}
            initialVoidFilter={salesInitialVoidFilter}
          />
        );
      case 'customers':
        return <CustomersView customers={customers} onChanged={reload} canManage={hasRole('Admin', 'Manager')} />;
      case 'reports':
        return <ReportsView symbol={symbol} />;
      case 'stock':
        return <StockView symbol={symbol} initialFilter={stockFilter ?? undefined} />;
      case 'drawer':
        return <DrawerView settings={settings} onDrawerChange={reload} />;
      case 'team':
        return <TeamView />;
      case 'settings':
        return <SettingsView settings={settings} onSaved={reload} />;
      case 'export':
        return <ExportView />;
      case 'printers':
        return <PrinterSettingsView />;
      case 'audit-log':
        return <AuditLogView canSettings={hasRole('Admin')} />;
      default:
        return null;
    }
  }

  function UserMenu() {
    const [profileOpen, setProfileOpen] = useState(false);
    const { t, locale, setLocale } = useLocale();

    return (
      <>
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
            <DropdownMenuItem onClick={() => setLocale(locale === 'en' ? 'ur' : 'en')}>
              <Globe className="size-4" /> {locale === 'en' ? t('profile.urdu') : t('profile.english')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="size-4" /> {t('profile.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => goTo('settings')}>
              <SettingsIcon className="size-4" /> {t('profile.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" /> {t('profile.signout')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => getPosBridge().quit()}
            >
              <Home className="size-4" /> {t('profile.quit')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('profile.title')}</DialogTitle>
              <DialogDescription>
                {t('profile.desc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {user ? initials(user.fullname) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.fullname}</p>
                  <p className="text-sm text-muted-foreground">@{user?.username}</p>
                  <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">{t('profile.role')}</span>
                  <span>{user?.role}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">{t('profile.language')}</span>
                  <Button variant="outline" size="sm" onClick={() => setLocale(locale === 'en' ? 'ur' : 'en')}>
                    {locale === 'en' ? t('profile.urdu') : t('profile.english')}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileOpen(false)}>{t('profile.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function HeldBell() {
    const { t } = useLocale();
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
            <p className="font-medium">{t('shell.heldOrders')}</p>
            <Badge variant="secondary">{heldOrders.length}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('shell.heldOrdersDesc')}
          </p>
          {heldOrders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('shell.noHeldOrders')}</p>
          ) : (
            <ul className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-auto">
              {heldOrders.map((o) => (
                <li key={o._id}>
                  <button
                    type="button"
                    onClick={() => setMode('till')}
                    className="flex w-full items-center justify-between rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="truncate">{o.customer_name || t('common.walkin')}</span>
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
    const { t } = useLocale();
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
            <span className="hidden md:inline">{t('shell.search')}</span>
            <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] font-medium text-muted-foreground md:inline">
              ⌘K
            </kbd>
          </Button>

          <HeldBell />

          {/* Drawer Status Indicator */}
          {drawerSession && canAccess(role, 'drawer') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-emerald-600 border-emerald-200 bg-emerald-50"
                >
                  <AlertTriangle className="size-4" />
                  <span className="hidden md:inline">{t('shell.drawerOpen')}</span>
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => goTo('drawer')}>
                  <ReceiptText className="size-4 mr-2" />
                  {t('shell.viewDrawer')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setCountedCash(String(drawerSession.floatAmount + (drawerSession.variance || 0)));
                    setCloseDrawerOpen(true);
                  }}
                >
                  <Calculator className="size-4 mr-2" />
                  {t('shell.closeDrawer')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!drawerSession && canAccess(role, 'drawer') && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-amber-600 border-amber-200 bg-amber-50"
              onClick={() => goTo('drawer')}
            >
              <AlertTriangle className="size-4" />
              <span className="hidden md:inline">{t('shell.openDrawer')}</span>
            </Button>
          )}

          {products.some(isLowStock) && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-amber-600 border-amber-200 bg-amber-50"
              onClick={() => goTo('menu')}
            >
              <AlertTriangle className="size-4" />
              <span className="hidden md:inline">
                {products.filter(isLowStock).length} {t('shell.lowStock')}
              </span>
            </Button>
          )}

          <UpdateIndicator />

          <Button size="sm" onClick={() => setMode('till')}>
            <PlusCircle className="size-4" />
            <span className="hidden sm:inline">{t('shell.newSale')}</span>
          </Button>

          <UserMenu />
        </div>
      </header>
    );
  }

  if (!landed) {
    return (
      <Landing
        storeName={storeName}
        logoUrl={logoUrl}
        onChoose={enterMode}
      />
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
          <ErrorBoundary fallbackTitle={t('errorBoundary.title')}>
            <TillView
              products={products}
              categories={categories}
              customers={customers}
              settings={settings}
              holdCount={holdCount}
              onHoldCount={setHoldCount}
              onRefresh={reload}
              loading={loading}
            />
          </ErrorBoundary>
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
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={runConfirmed}>{t('shell.switch')}</AlertDialogAction>
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
                tooltip={t('shell.quickOrder')}
                onClick={() => setMode('till')}
                className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                size="lg"
              >
                <UtensilsCrossed />
                <span>{t('shell.quickOrder')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel className="px-2 uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                {t(`nav.group.${group.id}`)}
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
                          tooltip={t(`nav.${item.id}`)}
                          className="data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)] data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                        >
                          <Icon />
                          <span>{t(`nav.${item.id}`)}</span>
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
          <div className="h-full overflow-auto p-6">
            <ErrorBoundary fallbackTitle={t('errorBoundary.title')}>
              {renderView()}
            </ErrorBoundary>
          </div>
        </main>
      </SidebarInset>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} commands={commands} />
      <Toaster />

      {/* Close Drawer Dialog */}
      <AlertDialog open={closeDrawerOpen} onOpenChange={setCloseDrawerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('drawer.endDay')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('drawer.endDayDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="counted-cash-topbar">{t('drawer.counted', { symbol })}</Label>
            <Input
              id="counted-cash-topbar"
              type="number"
              step="0.01"
              min={0}
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCloseDrawerOpen(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseDrawer}>{t('shell.closeDrawer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>{t('shell.switch')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
