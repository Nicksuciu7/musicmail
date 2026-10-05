import { Onboarding } from "@/components/onboarding";
import { requirePageUser } from "@/lib/server/auth-guard";
export default async function Page() {
  await requirePageUser();
  return <Onboarding />;
}
