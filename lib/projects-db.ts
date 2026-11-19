import { db } from "@/lib/db";
import { departments, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";

/** Shared by project create/edit: dates in order, department exists, manager belongs to it. */
export async function validateProjectRelations(
  departmentId: number | null, managerId: number | null, startDate: string, endDate: string | null
): Promise<string | null> {
  if (endDate && endDate < startDate) return "End date can't be before the start date";
  if (departmentId) {
    const [d] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId));
    if (!d) return "Department not found";
  }
  if (managerId) {
    const [m] = await db.select({ departmentId: employees.departmentId }).from(employees).where(eq(employees.id, managerId));
    if (!m) return "Project manager not found";
    if (departmentId && m.departmentId !== departmentId) return "Project manager must be in the project's department";
  }
  return null;
}
