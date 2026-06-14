import type { AccessRole } from "@/lib/access-control";

export function homePathForRole(role: AccessRole) {
  if (role === "field_worker") return "/field";
  if (role === "dispatcher") return "/dashboard";
  return "/admin/users";
}
