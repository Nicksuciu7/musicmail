import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "home",
      "explore",
      "network",
      "lists",
      "mail",
      "templates",
      "settings",
      "admin",
    ].includes(section)
  )
    notFound();
  return <Workspace page={section} />;
}
