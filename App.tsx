import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import VerificationRequired from './pages/VerificationRequired';
import { getCurrentUser, logout } from './services/auth';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { loadData } from './services/storage';
import { emitFinanceSnapshot } from './utils/financeDebugLogger';
import { LayoutDashboard, ShoppingCart, FileText, Package, ArrowRightLeft, Users, Menu, X, Settings as SettingsIcon, LogOut, Landmark, Truck, ClipboardList, BarChart3, Wrench } from 'lucide-react';
import { Button, LightweightLoader } from './components/ui';
import { useVersionCheck } from './src/hooks/useVersionCheck';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import DataDeletion from './pages/DataDeletion';
import RoleLoginModal from './components/auth/RoleLoginModal';
import { RestrictedPage } from './components/auth/PermissionGuard';
import { can, getCurrentAccessSession, isAccessUnlockedForUser, type SimplePermission } from './src/auth/simplePermissions';
import { RoleSessionProvider, useRoleSession } from './src/auth/roleSession';
const WhatsAppLogs = lazy(() => import('./pages/WhatsAppLogs'));

const Admin = lazy(() => import('./pages/Admin'));
const Sales = lazy(() => import('./pages/Sales'));
const Reports = lazy(() => import('./pages/Reports'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Customers = lazy(() => import('./pages/Customers'));
const Finance = lazy(() => import('./pages/Finance'));
const ExpenseRepair = lazy(() => import('./pages/ExpenseRepair'));
const FreightBooking = lazy(() => import('./pages/FreightBooking'));
const PurchasePanel = lazy(() => import('./pages/PurchasePanel'));
const PurchasePartyRepair = lazy(() => import('./pages/PurchasePartyRepair'));
const ProductAnalytics = lazy(() => import('./pages/ProductAnalytics'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Cashbook = lazy(() => import('./pages/Cashbook'));
const RepairCenter = lazy(() => import('./pages/RepairCenter'));

// --- Components ---

const NavItem = ({ to, icon: Icon, label, labelClassName = '', optimisticActivePath, onOptimisticActivate }: { to: string, icon: any, label: string, labelClassName?: string, optimisticActivePath?: string | null, onOptimisticActivate?: (path: string) => void }) => {
  const location = useLocation();
  const isActive = (optimisticActivePath || location.pathname) === to;
  return (
    <Link 
      to={to} 
      onClick={() => onOptimisticActivate?.(to)}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
        isActive 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className={labelClassName}>{label}</span>
    </Link>
  );
};


const RouteActivationObserver = ({ onRouteCommitted }: { onRouteCommitted: () => void }) => {
  const location = useLocation();
  useEffect(() => {
    onRouteCommitted();
  }, [location.pathname, onRouteCommitted]);
  return null;
};

const MenuController = ({ setIsMenuOpen }: { setIsMenuOpen: (open: boolean) => void }) => {
    const location = useLocation();
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);
    return null;
};

const ProtectedRoute = ({ isVerified, children }: { isVerified: boolean; children: React.ReactElement }) => {
  if (!isVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
};

const AccessControlledRoute = ({
  isVerified,
  children,
  permission,
  label,
}: {
  isVerified: boolean;
  children: React.ReactElement;
  permission?: SimplePermission;
  label?: string;
}) => {
  if (!isVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (permission && !can(permission)) {
    return <RestrictedPage permission={permission} label={label || 'This page'} />;
  }
  return children;
};

function AppContent() {
  const location = useLocation();
  const { session: roleSession, setSession: setRoleSession } = useRoleSession();
  const currentBuildId = typeof APP_BUILD_ID === 'string' ? APP_BUILD_ID : 'unknown';
  const { updateAvailable, latestVersionData, dismissUpdate } = useVersionCheck(currentBuildId);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unverified' | 'unauthenticated'>('loading');
  const [currentEmail, setCurrentEmail] = useState<string | null>(getCurrentUser());
  const [storeName, setStoreName] = useState('StockFlow');
  const [repairCenterEnabled, setRepairCenterEnabled] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ status: string; message?: string }>({ status: navigator.onLine ? 'loading' : 'offline' });
  const [opStatus, setOpStatus] = useState<{ phase: 'start' | 'success' | 'error'; message: string; op?: string } | null>(null);
  const [salesCartCount, setSalesCartCount] = useState(0);
  const [optimisticActivePath, setOptimisticActivePath] = useState<string | null>(null);
  const clearOptimisticActivePath = React.useCallback(() => setOptimisticActivePath(null), []);

  useEffect(() => {
    if (!auth) {
      const cachedUser = getCurrentUser();
      setCurrentEmail(cachedUser);
      setAuthStatus(cachedUser ? 'authenticated' : 'unauthenticated');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setCurrentEmail(null);
        setAuthStatus('unauthenticated');
        return;
      }

      const authedEmail = user.email || null;
      setCurrentEmail(authedEmail);
      setAuthStatus(user.emailVerified ? 'authenticated' : 'unverified');
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
      if (authStatus === 'authenticated') {
          const data = loadData();
          setStoreName(data.profile.storeName || 'StockFlow');
          setRepairCenterEnabled(Boolean(data.profile.repairCenterEnabled));
          emitFinanceSnapshot('app_load', data, { type: 'app_load', source: 'app' });
      }

      const handleStorageUpdate = () => {
         const data = loadData();
          setStoreName(data.profile.storeName || 'StockFlow');
         setRepairCenterEnabled(Boolean(data.profile.repairCenterEnabled));
      };

      window.addEventListener('local-storage-update', handleStorageUpdate);
      const handleCloudStatus = (event: Event) => {
        const detail = (event as CustomEvent<{ status: string; message?: string }>).detail;
        if (detail) setCloudStatus(detail);
      };
      const handleOpStatus = (event: Event) => {
        const detail = (event as CustomEvent<{ phase: 'start' | 'success' | 'error'; message?: string; error?: string; op?: string }>).detail;
        if (!detail) return;
        const message = detail.error || detail.message || (detail.phase === 'start' ? 'Saving…' : detail.phase === 'success' ? 'Saved.' : 'Operation failed.');
        setOpStatus({ phase: detail.phase, message, op: detail.op });
      };
      window.addEventListener('cloud-sync-status', handleCloudStatus as EventListener);
      window.addEventListener('data-op-status', handleOpStatus as EventListener);
      return () => {
        window.removeEventListener('local-storage-update', handleStorageUpdate);
        window.removeEventListener('cloud-sync-status', handleCloudStatus as EventListener);
        window.removeEventListener('data-op-status', handleOpStatus as EventListener);
      };
  }, [authStatus]);

  useEffect(() => {
    if (!opStatus || opStatus.phase === 'start') return;
    const t = setTimeout(() => setOpStatus(null), 3000);
    return () => clearTimeout(t);
  }, [opStatus]);

  useEffect(() => {
    const handleSalesCartState = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      setSalesCartCount(Number(detail?.count || 0));
    };
    window.addEventListener('sales-cart-state', handleSalesCartState as EventListener);
    return () => window.removeEventListener('sales-cart-state', handleSalesCartState as EventListener);
  }, []);

  const handleUpdate = () => {
    const currentHashPath = window.location.hash.replace('#', '') || '/';
    if (currentHashPath === '/sales' && salesCartCount > 0) {
      const shouldContinue = window.confirm('Unsaved transaction will be lost. Continue?');
      if (!shouldContinue) return;
    }
    const targetUrl = (latestVersionData?.targetUrl || '').trim();
    if (targetUrl) {
      window.location.assign(targetUrl);
      return;
    }
    window.location.reload();
  };

  const updateReleaseNotes = [
    'Expense saving issue fixed',
    'Purchase data fallback restored',
    'Customer ledger calculation preview improved',
    'Supplier statement warnings improved',
  ];
  const updateVersionLabel = latestVersionData?.version ? `Version ${latestVersionData.version}` : null;
  const updateDateLabel = latestVersionData?.deployedAt
    ? new Date(latestVersionData.deployedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const handleLoginSuccess = () => {
      setAuthStatus('authenticated');
  };

  const canShowRepairCenter = repairCenterEnabled;
  const isAccessUnlockedForCurrentUser = authStatus === 'authenticated' && isAccessUnlockedForUser(currentEmail);
  const accessRoleLabel = roleSession?.role === 'operator' ? (roleSession.operatorName || 'Staff') : 'Admin';

  const handleFullLogout = () => {
    logout();
  };

  const handleAccessLogin = (session: { role: 'admin' | 'operator'; operatorId?: string; operatorName?: string; loginAt: string }) => {
    setRoleSession(session);
  };

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      if (roleSession) setRoleSession(null);
      return;
    }

    if (!isAccessUnlockedForCurrentUser) {
      if (roleSession) setRoleSession(null);
      return;
    }

    if (!roleSession) {
      const storedSession = getCurrentAccessSession();
      if (storedSession) {
        setRoleSession({
          role: storedSession.role,
          operatorId: storedSession.operatorId,
          operatorName: storedSession.operatorName,
          loginAt: new Date().toISOString(),
        });
      }
    }
  }, [authStatus, currentEmail, isAccessUnlockedForCurrentUser, roleSession, setRoleSession]);

  const publicPaths = new Set(['/privacy-policy', '/terms', '/data-deletion']);
  const isPublicRoute = publicPaths.has(location.pathname);

  if (authStatus === 'loading') {
    if (isPublicRoute) {
      return (
        <Routes>
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="*" element={<Navigate to="/privacy-policy" replace />} />
        </Routes>
      );
    }
    return <div className="min-h-screen bg-background" />;
  }

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="*" element={<Navigate to="/privacy-policy" replace />} />
      </Routes>
    );
  }

  if (authStatus === 'unauthenticated') {
      return <Auth onLogin={handleLoginSuccess} />;
  }

  if (authStatus === 'unverified') {
      return <VerificationRequired email={currentEmail || undefined} />;
  }

  return (
      <>
      <RouteActivationObserver onRouteCommitted={clearOptimisticActivePath} />
      <MenuController setIsMenuOpen={setIsMenuOpen} />
      <div className="flex h-screen bg-background overflow-hidden">
        {updateAvailable && (
          <div className="fixed inset-x-3 bottom-3 z-[95] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[360px]">
            <div className="rounded-2xl border border-amber-200 bg-white/95 p-3 text-xs text-slate-800 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">Update available</span>
                    {(updateVersionLabel || updateDateLabel) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                        {[updateVersionLabel, updateDateLabel].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">A new version is ready with accounting fixes.</div>
                </div>
              </div>

              <details className="group mt-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <summary className="cursor-pointer select-none text-[11px] font-semibold text-slate-700 outline-none">
                  What changed?
                </summary>
                <div className="mt-1 text-[11px] text-slate-600">
                  <div className="font-medium text-slate-700">Fixes in this version:</div>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {updateReleaseNotes.map((note) => (
                      <li key={note} className="list-disc">{note}</li>
                    ))}
                  </ul>
                </div>
              </details>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button size="sm" className="h-8 bg-slate-900 px-3 text-white hover:bg-slate-800" onClick={handleUpdate}>Update Now</Button>
                <Button size="sm" variant="outline" className="h-8 border-slate-200 px-3 text-slate-700 hover:bg-slate-50" onClick={dismissUpdate}>Later</Button>
              </div>
            </div>
          </div>
        )}
        {(cloudStatus.status === 'offline' || cloudStatus.status === 'missing_store' || cloudStatus.status === 'error') && (
          <div className="fixed top-0 left-0 right-0 z-[80] bg-red-600 text-white text-xs px-3 py-2 text-center">
            {cloudStatus.message || 'Live cloud data unavailable. Business data operations are blocked until connection is restored.'}
          </div>
        )}
        {opStatus && (
          <div className={`fixed bottom-4 right-4 z-[90] rounded-lg px-3 py-2 text-xs shadow-lg ${opStatus.phase === 'error' ? 'bg-red-600 text-white' : opStatus.phase === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
            <div className="font-semibold">{opStatus.op || 'Data'}</div>
            <div>{opStatus.message}</div>
          </div>
        )}
        {/* Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col hidden md:flex">
          <div className="p-6">
            <h1 className="text-xl font-bold flex items-center gap-2 truncate" title={storeName}>
              <Package className="w-8 h-8 text-primary shrink-0" />
              {storeName}
            </h1>
          </div>
          
          <nav className="flex-1 px-4 space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-2">Menu</p>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            <NavItem to="/" icon={Package} label="Inventory" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            <NavItem to="/sales" icon={ShoppingCart} label="POS System" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            <NavItem to="/transactions" icon={ArrowRightLeft} label="Transactions" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            {can('analytics') && <NavItem to="/product-analytics" icon={BarChart3} label="Product Analytics" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            <NavItem to="/customers" icon={Users} label="Customers" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            {can('reports') && <NavItem to="/pdf" icon={FileText} label="Reports" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            {canShowRepairCenter && <NavItem to="/repair-center" icon={Wrench} label="Repair Center" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            {can('settings') && <NavItem to="/settings" icon={SettingsIcon} label="Settings" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            {can('cashbook') && <NavItem to="/cashbook" icon={Landmark} label="Cashbook" labelClassName="text-red-600" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            <NavItem to="/finance" icon={Landmark} label="Finance" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />
            {can('freight') && <NavItem to="/freight-booking" icon={Truck} label="Freight Booking" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}
            {can('purchases') && <NavItem to="/purchase-panel" icon={ClipboardList} label="Purchase Parties" optimisticActivePath={optimisticActivePath} onOptimisticActivate={setOptimisticActivePath} />}

          </nav>
          
          <div className="p-4 border-t flex flex-col gap-2">
             <div className="text-xs text-muted-foreground mt-2">
                <p>User: {currentEmail}</p>
                <p>Access: {accessRoleLabel}</p>
             </div>
             <Button variant="ghost" size="sm" onClick={handleFullLogout} className="w-full text-muted-foreground hover:text-destructive justify-start px-2">
                <LogOut className="w-4 h-4 mr-2" /> Logout
             </Button>
          </div>
        </div>

        {/* Mobile Navigation (Bottom) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t h-16 flex items-center justify-around px-2 z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
           <Link to="/" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Stock</span>
           </Link>
           <Link to="/sales" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">POS</span>
           </Link>

           <Link to="/customers" className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Clients</span>
           </Link>

           <button onClick={() => setIsMenuOpen(true)} className="flex flex-col items-center justify-center w-14 h-full text-muted-foreground hover:text-primary active:text-primary/70">
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">More</span>
           </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col justify-end animate-in slide-in-from-bottom-10" onClick={() => setIsMenuOpen(false)}>
                <div className="bg-card rounded-t-2xl p-6 space-y-4 pb-8" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-lg">Menu</h3>
                        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)}><X className="w-5 h-5" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <Link to="/transactions" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2">
                                  <ArrowRightLeft className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Transactions</span>
                         </Link>
                         {can('reports') && <Link to="/pdf" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-purple-100 text-purple-600 rounded-full mb-2">
                                  <FileText className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Reports</span>
                         </Link>}
                         <Link to="/dashboard" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-2">
                                  <LayoutDashboard className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Dashboard</span>
                         </Link>
                         {can('analytics') && <Link to="/product-analytics" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-cyan-100 text-cyan-600 rounded-full mb-2">
                                  <BarChart3 className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Product Analytics</span>
                         </Link>}
                         <Link to="/finance" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full mb-2">
                                  <Landmark className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Finance</span>
                         </Link>
                         {can('freight') && <Link to="/freight-booking" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-orange-100 text-orange-600 rounded-full mb-2">
                                  <Truck className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Freight Booking</span>
                         </Link>}
                         {can('purchases') && <Link to="/purchase-panel" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-cyan-100 text-cyan-600 rounded-full mb-2">
                                  <ClipboardList className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Purchase Parties</span>
                         </Link>}
                         {can('settings') && <Link to="/settings" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-gray-100 text-gray-600 rounded-full mb-2">
                                  <SettingsIcon className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Settings</span>
                         </Link>}
                         {canShowRepairCenter && <Link to="/repair-center" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors border border-transparent hover:border-primary/20">
                              <div className="p-3 bg-amber-100 text-amber-700 rounded-full mb-2">
                                  <Wrench className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm">Repair Center</span>
                         </Link>}
                         <button onClick={handleFullLogout} className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-200">
                              <div className="p-3 bg-white text-red-600 rounded-full mb-2 shadow-sm">
                                  <LogOut className="w-6 h-6" />
                              </div>
                              <span className="font-medium text-sm text-red-700">Logout</span>
                         </button>
                    </div>
                </div>
            </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="min-h-full p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
            <Suspense fallback={<LightweightLoader label="Loading page…" className="min-h-[320px]" />}>
              <Routes>
                <Route path="/" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Admin /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Transactions /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Dashboard /></ProtectedRoute>} />
                <Route path="/product-analytics" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="analytics" label="Product Analytics"><ProductAnalytics /></AccessControlledRoute>} />
                <Route path="/customers" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Customers /></ProtectedRoute>} />
                <Route path="/pdf" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="reports" label="Reports"><Reports /></AccessControlledRoute>} />
                <Route path="/repair-center" element={canShowRepairCenter ? <ProtectedRoute isVerified={authStatus === "authenticated"}><RepairCenter /></ProtectedRoute> : <Navigate to={can('settings') ? "/settings" : "/"} replace />} />
                <Route path="/settings" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="settings" label="Settings"><Settings /></AccessControlledRoute>} />
                <Route path="/whatsapp-logs" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="settings" label="WhatsApp Logs"><WhatsAppLogs /></AccessControlledRoute>} />
                <Route path="/cashbook" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="cashbook" label="Cashbook"><Cashbook /></AccessControlledRoute>} />
                <Route path="/finance" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Finance /></ProtectedRoute>} />
                <Route path="/expense-repair" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="settings" label="Expense Repair"><ExpenseRepair /></AccessControlledRoute>} />
                <Route path="/freight-booking" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="freight" label="Freight Booking"><FreightBooking /></AccessControlledRoute>} />
                <Route path="/purchase-panel" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="purchases" label="Purchase Parties"><PurchasePanel /></AccessControlledRoute>} />
                <Route path="/purchase-party-repair" element={<AccessControlledRoute isVerified={authStatus === "authenticated"} permission="purchases" label="Purchase Party Repair"><PurchasePartyRepair /></AccessControlledRoute>} />
                
                {/* Unprotected Route (POS) */}
                <Route path="/sales" element={<ProtectedRoute isVerified={authStatus === "authenticated"}><Sales /></ProtectedRoute>} />
                
                <Route path="/verify-email" element={<VerificationRequired email={currentEmail || undefined} />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      {authStatus === 'authenticated' && !roleSession && <RoleLoginModal onLogin={handleAccessLogin} />}
    </>
  );
}

export default function App() {
  return <RoleSessionProvider><Router><AppContent /></Router></RoleSessionProvider>;
}
