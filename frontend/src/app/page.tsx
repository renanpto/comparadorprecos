import { redirect } from "next/navigation";
import { listarObras } from "@/lib/api-client";

export default async function RootPage() {
  const { obras } = await listarObras();
  if (obras.length === 0) {
    redirect("/obras/nova");
  }
  redirect(`/obras/${obras[0].obraId}`);
}
