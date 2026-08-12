import { useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  Download,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Printer,
  ReceiptText,
  Settings as SettingsIcon,
  ShoppingCart,
  Store,
  Timer,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Toaster } from '../components/ui/sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { useAuth } from '../context/AuthContext';
import { useStoreData } from '../hooks/useStoreData';
import { getPosBridge } from '../bridge';
import { getUploadsBase } from '../api/client';
import { buildLogoUrl } from '../lib/branding';
import { buildNavGroups, resolveInitialView, type NavItemId, type Permissions } from '../lib/nav';
import { buildDateRange, type RangePreset } from '../lib/dateRange';
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

export default function AppShell() {
  const { user, hasPerm, logout } = useAuth();
  const { products, categories, customers, settings, error, reload } = useStoreData();
  const [mode, setMode] = useState<Mode>('till');
  const [holdCount, setHoldCount] = useState(0);
  const [preset, setPreset] = useState<RangePreset>('today');

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
  const range = buildDateRange(preset);
  const symbol = settings?.symbol || 'Rs';
  const logoUrl = buildLogoUrl(settings?.img, getUploadsBase());

  function renderView() {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView settings={settings} range={range} />;
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

  function TopBar({ withTrigger }: { withTrigger: boolean }) {
    return (
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        {withTrigger && <SidebarTrigger />}
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={settings?.store || 'Store'} className="size-7 rounded object-contain" />
          ) : (
            <Store className="size-5 text-primary" />
          )}
          <span className="font-semibold">{settings?.store || 'Store POS'}</span>
        </div>

        <div className="ml-2 flex rounded-md border p-0.5">
          <Button
            variant={mode === 'till' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('till')}
          >
            <ShoppingCart className="size-4" />
            Till
          </Button>
          <Button
            variant={mode === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('dashboard')}
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </Button>
        </div>

        {mode === 'dashboard' && (
          <div className="ml-2 flex items-center gap-2">
            <CalendarRange className="size-4 text-muted-foreground" />
            <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode('till')}>
            <PlusCircle className="size-4" />
            New Sale
          </Button>
          <span className="text-sm text-muted-foreground">{user?.fullname}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
          <Button variant="ghost" size="sm" onClick={() => getPosBridge().quit()}>
            <Home className="size-4" />
            Quit
          </Button>
        </div>
      </header>
    );
  }

  if (mode === 'till') {
    return (
      <div className="flex h-screen flex-col bg-background">
        <TopBar withTrigger={false} />
        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <main className="min-h-0 flex-1">
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
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="text-base" tooltip="Till" onClick={() => setMode('till')}>
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-5 rounded object-contain" />
                ) : (
                  <ShoppingCart className="size-5" />
                )}
                <span className="font-semibold">{settings?.store || 'Store POS'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = ICONS[item.icon] ?? Package;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeView === item.id}
                          onClick={() => setView(item.id)}
                          tooltip={item.label}
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sign out"
                onClick={() => {
                  void logout();
                }}
              >
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Quit" onClick={() => getPosBridge().quit()}>
                <Home />
                <span>Quit</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-4 py-2 text-xs text-muted-foreground">
            {user?.fullname} · {user?.username}
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <TopBar withTrigger />
        {error && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-auto p-6">{renderView()}</main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
