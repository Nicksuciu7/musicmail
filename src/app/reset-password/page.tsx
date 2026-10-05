import { AuthForm } from "@/components/auth-form";
import { demoEnabled } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <AuthForm mode="reset" demo={demoEnabled()} />;
}
