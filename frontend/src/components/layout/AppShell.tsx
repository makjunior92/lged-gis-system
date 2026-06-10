import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { LayoutProvider } from '@/contexts/LayoutContext';

export default function AppShell() {
  return (
    <LayoutProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-100">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
}
