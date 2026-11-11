import { pgTable, pgEnum, varchar, serial, integer, doublePrecision, text, boolean, unique } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "HR", "DEPT_HEAD", "TEAM_LEAD", "EMPLOYEE"]);

export const moduleEnum = pgEnum("module", [
  "DASHBOARD", "EMPLOYEES", "ATTENDANCE", "LEAVES", "TASKS",
  "PAYROLL", "DOCUMENTS", "FINANCE", "DEPARTMENTS", "CALENDAR",
  "ANNOUNCEMENTS", "AUDIT_LOG",
]);

export const actionEnum = pgEnum("action", ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT"]);

export const scopeEnum = pgEnum("scope", ["ALL", "DEPARTMENT", "SELF"]);

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  description: varchar("description", { length: 512 }).default(""),
  color: varchar("color", { length: 16 }).default("#6C5DD3"),
  headId: integer("head_id"), // FK -> users.id (references() omitted: users<->departments are mutually referential)
  budget: doublePrecision("budget").notNull().default(0),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  password: varchar("password", { length: 191 }).notNull(),
  role: roleEnum("role").notNull().default("EMPLOYEE"),
  employeeId: integer("employee_id"),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: varchar("created_at", { length: 64 }).notNull().default(""),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }).default(""),
  position: varchar("position", { length: 191 }).notNull(),
  departmentId: integer("department_id"),
  joinDate: varchar("join_date", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | inactive | on_leave
  avatarColor: varchar("avatar_color", { length: 16 }).default("#6C5DD3"),
  baseSalary: doublePrecision("base_salary").notNull().default(0),
  address: varchar("address", { length: 512 }).default(""),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: varchar("date", { length: 16 }).notNull(), // YYYY-MM-DD
  checkIn: varchar("check_in", { length: 16 }),
  checkOut: varchar("check_out", { length: 16 }),
  status: varchar("status", { length: 16 }).notNull().default("present"), // present | absent | late | half_day
  approvalStatus: varchar("approval_status", { length: 16 }).notNull().default("approved"), // pending | approved | rejected
});

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  type: varchar("type", { length: 16 }).notNull(), // sick | casual | annual | unpaid
  startDate: varchar("start_date", { length: 16 }).notNull(),
  endDate: varchar("end_date", { length: 16 }).notNull(),
  reason: varchar("reason", { length: 512 }).default(""),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | recommended | approved | rejected
  appliedOn: varchar("applied_on", { length: 64 }).notNull(),
});

export const payroll = pgTable("payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  basic: doublePrecision("basic").notNull(),
  bonus: doublePrecision("bonus").notNull().default(0),
  deduction: doublePrecision("deduction").notNull().default(0),
  net: doublePrecision("net").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | paid
  paidOn: varchar("paid_on", { length: 16 }),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  name: varchar("name", { length: 191 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("general"), // contract | id | certificate | general
  uploadDate: varchar("upload_date", { length: 16 }).notNull(),
  size: varchar("size", { length: 32 }).default("—"),
  url: varchar("url", { length: 512 }), // Vercel Blob URL of the uploaded file, null for legacy/sample records
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 16 }).notNull(), // income | expense
  category: varchar("category", { length: 64 }).notNull(), // sales, salaries, rent, utilities, marketing, software, other
  description: varchar("description", { length: 255 }).default(""),
  amount: doublePrecision("amount").notNull(),
  date: varchar("date", { length: 16 }).notNull(),
  method: varchar("method", { length: 32 }).default("bank"), // bank | cash | mobile_banking | card
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: varchar("invoice_no", { length: 32 }).notNull().unique(),
  clientName: varchar("client_name", { length: 191 }).notNull(),
  clientEmail: varchar("client_email", { length: 191 }).default(""),
  amount: doublePrecision("amount").notNull(),
  issueDate: varchar("issue_date", { length: 16 }).notNull(),
  dueDate: varchar("due_date", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("unpaid"), // unpaid | paid | overdue
  notes: varchar("notes", { length: 512 }).default(""),
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  role: roleEnum("role").notNull(),
  module: moduleEnum("module").notNull(),
  action: actionEnum("action").notNull(),
  scope: scopeEnum("scope").notNull(),
  isAllowed: boolean("is_allowed").notNull().default(true),
}, (t) => [unique().on(t.role, t.module, t.action)]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 191 }).notNull(),
  description: text("description"),
  assigneeId: integer("assignee_id"),
  dueDate: varchar("due_date", { length: 16 }),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"), // low | medium | high
  status: varchar("status", { length: 16 }).notNull().default("todo"), // todo | in_progress | done
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});
