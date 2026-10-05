import { AuthForm } from "@/components/auth-form";
import { demoEnabled } from "@/lib/server/supabase";
import { requirePageUser } from "@/lib/server/auth-guard";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requirePageUser();
  return <AuthForm mode="change" demo={demoEnabled()} />;
}
