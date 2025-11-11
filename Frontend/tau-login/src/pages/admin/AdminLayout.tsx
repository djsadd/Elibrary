import { Outlet } from "react-router-dom";
import DashboardHeader from "../../components/layout/DashboardHeader";

export default function AdminLayout() {
  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="bg-white rounded-md p-4">
        <Outlet />
      </div>
    </div>
  );
}
