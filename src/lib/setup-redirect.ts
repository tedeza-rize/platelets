import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup-state";

export async function requireSetupComplete() {
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }
}
