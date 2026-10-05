import { requireAdminPage } from "@/lib/server/admin";
import { Workspace } from "@/components/workspace";
export default async function AdminPage() {
  // Pages also guard themselves: layouts may be reused during navigation.
  await requireAdminPage();
  return <Workspace page="admin" />;
}
