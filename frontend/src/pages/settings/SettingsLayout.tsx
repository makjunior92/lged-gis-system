import { Outlet } from 'react-router-dom';

export default function SettingsLayout() {
  return (
    <div className="min-h-full p-2">
      <Outlet />
    </div>
  );
}
