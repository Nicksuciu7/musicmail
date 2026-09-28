import { redirect } from "next/navigation";
export default async function AppAlias({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  redirect("/" + (path?.[0] || "home"));
}
