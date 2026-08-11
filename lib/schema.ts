import { mysqlTable, varchar, int, double, text } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  password: varchar("password", { length: 191 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("admin"), // admin | hr | employee
  employeeId: int("employee_id"),
  createdAt: varchar("created_at", { length: 64 }).notNull().default(""),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  description: varchar("description", { length: 512 }).default(""),
  color: varchar("color", { length: 16 }).default("#6C5DD3"),
  headEmployeeId: int("head_employee_id"),
  budget: double("budget").notNull().default(0),
});

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  phone: varchar("phone", { length: 32 }).default(""),
  position: varchar("position", { length: 191 }).notNull(),
  departmentId: int("department_id"),
  joinDate: varchar("join_date", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | inactive | on_leave
  avatarColor: varchar("avatar_color", { length: 16 }).default("#6C5DD3"),
  baseSalary: double("base_salary").notNull().default(0),
  address: varchar("address", { length: 512 }).default(""),
});

export const attendance = mysqlTable("attendance", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull(),
  date: varchar("date", { length: 16 }).notNull(), // YYYY-MM-DD
  checkIn: varchar("check_in", { length: 16 }),
  checkOut: varchar("check_out", { length: 16 }),
  status: varchar("status", { length: 16 }).notNull().default("present"), // present | absent | late | half_day
  approvalStatus: varchar("approval_status", { length: 16 }).notNull().default("approved"), // pending | approved | rejected
});

export const leaves = mysqlTable("leaves", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull(),
  type: varchar("type", { length: 16 }).notNull(), // sick | casual | annual | unpaid
  startDate: varchar("start_date", { length: 16 }).notNull(),
  endDate: varchar("end_date", { length: 16 }).notNull(),
  reason: varchar("reason", { length: 512 }).default(""),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | approved | rejected
  appliedOn: varchar("applied_on", { length: 64 }).notNull(),
});

export const payroll = mysqlTable("payroll", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  basic: double("basic").notNull(),
  bonus: double("bonus").notNull().default(0),
  deduction: double("deduction").notNull().default(0),
  net: double("net").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | paid
  paidOn: varchar("paid_on", { length: 16 }),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employee_id"),
  name: varchar("name", { length: 191 }).notNull(),
  category: varchar("category", { length: 32 }).notNull().default("general"), // contract | id | certificate | general
  uploadDate: varchar("upload_date", { length: 16 }).notNull(),
  size: varchar("size", { length: 32 }).default("—"),
  url: varchar("url", { length: 512 }), // Vercel Blob URL of the uploaded file, null for legacy/sample records
});

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 16 }).notNull(), // income | expense
  category: varchar("category", { length: 64 }).notNull(), // sales, salaries, rent, utilities, marketing, software, other
  description: varchar("description", { length: 255 }).default(""),
  amount: double("amount").notNull(),
  date: varchar("date", { length: 16 }).notNull(),
  method: varchar("method", { length: 32 }).default("bank"), // bank | cash | mobile_banking | card
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNo: varchar("invoice_no", { length: 32 }).notNull().unique(),
  clientName: varchar("client_name", { length: 191 }).notNull(),
  clientEmail: varchar("client_email", { length: 191 }).default(""),
  amount: double("amount").notNull(),
  issueDate: varchar("issue_date", { length: 16 }).notNull(),
  dueDate: varchar("due_date", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("unpaid"), // unpaid | paid | overdue
  notes: varchar("notes", { length: 512 }).default(""),
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 191 }).notNull(),
  description: text("description"),
  assigneeId: int("assignee_id"),
  dueDate: varchar("due_date", { length: 16 }),
  priority: varchar("priority", { length: 16 }).notNull().default("medium"), // low | medium | high
  status: varchar("status", { length: 16 }).notNull().default("todo"), // todo | in_progress | done
  createdAt: varchar("created_at", { length: 64 }).notNull(),
});
