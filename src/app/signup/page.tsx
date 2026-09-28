import { AuthForm } from "@/components/auth-form";
import { demoEnabled } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthForm signup demo={demoEnabled()} />;
}
