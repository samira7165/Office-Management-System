import "./load-env";
import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  users,
  departments,
  employees,
  attendance,
  leaves,
  payroll,
  documents,
  tasks,
  transactions,
  invoices,
  permissions,
  projects,
  clients,
} from "../lib/schema";
import { PERMISSION_SEED } from "../lib/authz";

type Role = "SUPER_ADMIN" | "HR" | "DEPT_HEAD" | "TEAM_LEAD" | "EMPLOYEE";

async function main() {
  await db.execute(
    sql`TRUNCATE TABLE permissions, project_installments, projects, clients, invoices, transactions, tasks, documents, payroll, leaves, attendance, employees, departments, users RESTART IDENTITY`
  );

  // 0. Permissions — the RBAC matrix (lib/authz.ts is the single source of truth).
  await db.insert(permissions).values(
    PERMISSION_SEED.map((p) => ({ role: p.role, module: p.module, action: p.action, scope: p.scope, isAllowed: true }))
  );

  // 1. Departments first (headId is set later, once the head's user account exists)
  const deptSpecs: [string, string, string][] = [
    ["Engineering", "Product & platform engineering", "#6C5DD3"],
    ["Marketing", "Growth & communications", "#F6A723"],
    ["Design", "Product & brand design", "#3DB2FF"],
    ["HR", "People operations", "#1DBF73"],
    ["Finance", "Accounts & financial planning", "#F45252"],
  ];
  const deptRows = await db
    .insert(departments)
    .values(deptSpecs.map(([name, description, color]) => ({ name, description, color })))
    .returning({ id: departments.id });
  const [engId, marketingId, designId, hrId, financeId] = deptRows.map((r) => r.id);

  // 2. Employees (HR/org record) — 3 per department, first person in each is that dept's head
  const colors = ["#6C5DD3", "#3DB2FF", "#F6A723", "#1DBF73", "#F45252", "#8B5CF6", "#EC4899"];
  const employeesData: [string, string, string, string, number, string, string, number][] = [
    ["Rahim Uddin", "rahim@officehub.com", "+880 1711-000201", "Engineering Head", engId, "2019-02-10", "active", 95000],
    ["Ayesha Rahman", "ayesha.rahman@officehub.com", "+880 1711-000111", "Senior Software Engineer", engId, "2022-03-14", "active", 68000],
    ["Tanvir Ahmed", "tanvir.ahmed@officehub.com", "+880 1711-000112", "Frontend Developer", engId, "2023-01-09", "active", 52000],

    ["Karim Chowdhury", "karim@officehub.com", "+880 1711-000202", "Marketing Head", marketingId, "2019-06-01", "active", 90000],
    ["Sadia Akter", "sadia.akter@officehub.com", "+880 1711-000115", "Marketing Manager", marketingId, "2020-08-11", "active", 60000],
    ["Mahin Chowdhury", "mahin.chowdhury@officehub.com", "+880 1711-000116", "Content Strategist", marketingId, "2024-02-05", "active", 42000],

    ["Fatima Begum", "fatima@officehub.com", "+880 1711-000203", "Design Head", designId, "2019-09-15", "active", 88000],
    ["Nusrat Jahan", "nusrat.jahan@officehub.com", "+880 1711-000113", "UI/UX Designer", designId, "2021-11-02", "active", 55000],
    ["Rafiul Islam", "rafiul.islam@officehub.com", "+880 1711-000114", "Product Designer", designId, "2023-06-20", "on_leave", 50000],

    ["Farzana Yasmin", "hr@officehub.com", "+880 1711-000117", "HR Manager", hrId, "2019-05-19", "active", 58000],
    ["Imran Kabir", "imran.kabir@officehub.com", "+880 1711-000118", "Recruiter", hrId, "2023-09-01", "active", 40000],
    ["Nabila Islam", "nabila.islam@officehub.com", "+880 1711-000120", "HR Coordinator", hrId, "2021-07-23", "active", 47000],

    ["Sabbir Hossain", "sabbir.hossain@officehub.com", "+880 1711-000119", "Finance Executive", financeId, "2022-12-15", "active", 48000],
    ["Kamrul Hasan", "kamrul.hasan@officehub.com", "+880 1711-000121", "Accountant", financeId, "2023-04-18", "active", 50000],
    ["Rima Sultana", "rima.sultana@officehub.com", "+880 1711-000122", "Financial Analyst", financeId, "2024-01-22", "active", 46000],
  ];
  const empRows = await db
    .insert(employees)
    .values(
      employeesData.map(([name, email, phone, position, departmentId, joinDate, status, baseSalary], i) => ({
        name, email, phone, position, departmentId, joinDate, status,
        avatarColor: colors[i % colors.length],
        baseSalary,
        address: "Dhaka, Bangladesh",
      }))
    )
    .returning({ id: employees.id });
  const empIds = empRows.map((r) => r.id);
  // 0 Rahim(head) 1 Ayesha(TL) 2 Tanvir | 3 Karim(head) 4 Sadia 5 Mahin
  // 6 Fatima(head) 7 Nusrat 8 Rafiul | 9 Farzana(HR/head) 10 Imran 11 Nabila
  // 12 Sabbir 13 Kamrul 14 Rima

  // 3. User logins — role + departmentId per person. SUPER_ADMIN has no department/employee record.
  const adminPass = await bcrypt.hash("admin123", 10);
  const deptHeadPass = await bcrypt.hash("depthead123", 10);
  const teamLeadPass = await bcrypt.hash("teamlead123", 10);
  const hrPass = await bcrypt.hash("hr123", 10);
  const employeePass = await bcrypt.hash("employee123", 10);
  const now = new Date();

  const userSpecs: { name: string; email: string; password: string; role: Role; employeeId: number | null; departmentId: number | null }[] = [
    { name: "Admin User", email: "admin@officehub.com", password: adminPass, role: "SUPER_ADMIN", employeeId: null, departmentId: null },

    { name: "Rahim Uddin", email: "rahim@officehub.com", password: deptHeadPass, role: "DEPT_HEAD", employeeId: empIds[0], departmentId: engId },
    { name: "Ayesha Rahman", email: "ayesha.rahman@officehub.com", password: teamLeadPass, role: "TEAM_LEAD", employeeId: empIds[1], departmentId: engId },
    { name: "Tanvir Ahmed", email: "tanvir.ahmed@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[2], departmentId: engId },

    { name: "Karim Chowdhury", email: "karim@officehub.com", password: deptHeadPass, role: "DEPT_HEAD", employeeId: empIds[3], departmentId: marketingId },
    { name: "Sadia Akter", email: "sadia.akter@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[4], departmentId: marketingId },
    { name: "Mahin Chowdhury", email: "mahin.chowdhury@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[5], departmentId: marketingId },

    { name: "Fatima Begum", email: "fatima@officehub.com", password: deptHeadPass, role: "DEPT_HEAD", employeeId: empIds[6], departmentId: designId },
    { name: "Nusrat Jahan", email: "nusrat.jahan@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[7], departmentId: designId },
    { name: "Rafiul Islam", email: "rafiul.islam@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[8], departmentId: designId },

    { name: "Farzana Yasmin", email: "hr@officehub.com", password: hrPass, role: "HR", employeeId: empIds[9], departmentId: hrId },
    { name: "Imran Kabir", email: "imran.kabir@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[10], departmentId: hrId },
    { name: "Nabila Islam", email: "nabila.islam@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[11], departmentId: hrId },

    { name: "Sabbir Hossain", email: "sabbir.hossain@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[12], departmentId: financeId },
    { name: "Kamrul Hasan", email: "kamrul.hasan@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[13], departmentId: financeId },
    { name: "Rima Sultana", email: "rima.sultana@officehub.com", password: employeePass, role: "EMPLOYEE", employeeId: empIds[14], departmentId: financeId },
  ];
  const userRows = await db
    .insert(users)
    .values(userSpecs.map((u) => ({ ...u, createdAt: now.toISOString() })))
    .returning({ id: users.id });
  // userRows[0]=admin, [1]=Rahim, [4]=Karim, [7]=Fatima, [10]=Farzana — same order as userSpecs above.

  // 4. Now that head user accounts exist, wire up departments.headId + budgets.
  // Finance intentionally has no head — overseen directly by SUPER_ADMIN/HR.
  await db.update(departments).set({ headId: userRows[1].id, budget: 500000 }).where(eq(departments.id, engId));
  await db.update(departments).set({ headId: userRows[4].id, budget: 300000 }).where(eq(departments.id, marketingId));
  await db.update(departments).set({ headId: userRows[7].id, budget: 250000 }).where(eq(departments.id, designId));
  await db.update(departments).set({ headId: userRows[10].id, budget: 200000 }).where(eq(departments.id, hrId));
  await db.update(departments).set({ budget: 150000 }).where(eq(departments.id, financeId));

  function fmtDate(d: Date) {
    return d.toISOString().slice(0, 10);
  }
  const today = new Date();

  // 5. Attendance — 14 days per employee (skip Fri/Sat), plus 2 pending self-submitted entries.
  const attendanceRows: (typeof attendance.$inferInsert)[] = [];
  for (const empId of empIds) {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const day = d.getDay();
      if (day === 5 || day === 6) continue; // Fri/Sat weekend (BD)
      const roll = Math.random();
      let status = "present",
        checkIn: string | null = "09:0" + Math.floor(Math.random() * 9),
        checkOut: string | null = "18:0" + Math.floor(Math.random() * 9);
      if (roll < 0.06) {
        status = "absent";
        checkIn = null;
        checkOut = null;
      } else if (roll < 0.16) {
        status = "late";
        checkIn = "10:1" + Math.floor(Math.random() * 5);
      }
      attendanceRows.push({ employeeId: empId, date: fmtDate(d), checkIn, checkOut, status });
    }
  }
  const pendingAttendance: [number, string][] = [
    [empIds[2], "09:05"],  // Tanvir Ahmed (Engineering) — pending on Rahim
    [empIds[14], "09:12"], // Rima Sultana (Finance) — no dept head, falls to SUPER_ADMIN/HR
  ];
  for (const [employeeId, checkIn] of pendingAttendance) {
    attendanceRows.push({ employeeId, date: fmtDate(today), checkIn, checkOut: null, status: "present", approvalStatus: "pending" });
  }
  await db.insert(attendance).values(attendanceRows);

  // 6. Leaves — spread across every department, including one "recommended" (by a TEAM_LEAD)
  // to exercise the new approval chain, and a pending one per department.
  const leaveSamples: [number, string, string, string, string, string][] = [
    [empIds[2], "annual", "2026-08-05", "2026-08-09", "Family trip to Sylhet", "pending"],       // Tanvir (Eng) — pending, awaiting Rahim
    [empIds[2], "sick", "2026-07-20", "2026-07-21", "Fever", "recommended"],                     // Tanvir (Eng) — recommended by Ayesha (TEAM_LEAD)
    [empIds[4], "casual", "2026-08-12", "2026-08-12", "Personal errand", "pending"],              // Sadia (Marketing) — pending, awaiting Karim
    [empIds[5], "sick", "2026-07-15", "2026-07-16", "Food poisoning", "approved"],
    [empIds[7], "annual", "2026-09-01", "2026-09-05", "Eid vacation", "pending"],                 // Nusrat (Design) — pending, awaiting Fatima
    [empIds[8], "unpaid", "2026-07-01", "2026-07-10", "Extended personal leave", "approved"],
    [empIds[10], "sick", "2026-07-28", "2026-07-29", "Fever", "approved"],
    [empIds[11], "casual", "2026-08-14", "2026-08-14", "Personal errand", "pending"],             // Nabila (HR) — pending, awaiting Farzana
    [empIds[12], "annual", "2026-08-20", "2026-08-22", "Family function", "pending"],             // Sabbir (Finance) — pending, no dept head
    [empIds[13], "sick", "2026-07-10", "2026-07-11", "Flu", "approved"],
  ];
  await db.insert(leaves).values(
    leaveSamples.map(([employeeId, type, startDate, endDate, reason, status]) => ({
      employeeId, type, startDate, endDate, reason, status, appliedOn: now.toISOString(),
    }))
  );

  // 7. Tasks — assigned within each department (mirrors the "DEPT_HEAD/TEAM_LEAD can only
  // assign within their own department" rule enforced in the API).
  const taskSamples: [string, string, number, string, string, string][] = [
    ["Finalize sprint backlog", "Groom and prioritize next sprint's tickets", empIds[2], "2026-08-10", "high", "in_progress"],
    ["Code review guidelines doc", "Write up the team's PR review checklist", empIds[1], "2026-08-15", "medium", "todo"],
    ["Q3 campaign plan", "Draft the Q3 marketing campaign brief", empIds[4], "2026-08-08", "high", "in_progress"],
    ["Blog content calendar", "Plan blog posts for the next 6 weeks", empIds[5], "2026-08-20", "low", "todo"],
    ["Dashboard icon set", "Icon set for the HR management redesign", empIds[7], "2026-08-07", "medium", "in_progress"],
    ["Landing page mockups", "New landing page hero + pricing section", empIds[8], "2026-08-18", "medium", "todo"],
    ["Update employee handbook", "Add new remote work policy section", empIds[10], "2026-08-20", "low", "todo"],
    ["Review leave requests", "Approve/reject pending leave applications", empIds[11], "2026-08-05", "high", "done"],
    ["Prepare monthly report", "Compile August finance summary", empIds[12], "2026-08-06", "high", "todo"],
    ["Reconcile Q2 accounts", "Match ledger entries against bank statements", empIds[13], "2026-08-12", "medium", "in_progress"],
  ];
  await db.insert(tasks).values(
    taskSamples.map(([title, description, assigneeId, dueDate, priority, status]) => ({
      title, description, assigneeId, dueDate, priority, status, createdAt: now.toISOString(),
    }))
  );

  // 8. Documents
  const docSamples: [number, string, string, string][] = [
    [empIds[0], "Employment Contract.pdf", "contract", "300 KB"],
    [empIds[0], "NID Copy.pdf", "id", "120 KB"],
    [empIds[7], "Design Certification.pdf", "certificate", "540 KB"],
    [empIds[9], "HR Policy Handbook.pdf", "general", "1.1 MB"],
    [empIds[13], "Finance Certification.pdf", "certificate", "410 KB"],
    [empIds[4], "Marketing Certification.pdf", "certificate", "390 KB"],
  ];
  await db.insert(documents).values(
    docSamples.map(([employeeId, name, category, size]) => ({
      employeeId, name, category, uploadDate: fmtDate(today), size,
    }))
  );

  // 9. Payroll — 2 months per employee
  const payrollRows: (typeof payroll.$inferInsert)[] = [];
  for (const [idx, empId] of empIds.entries()) {
    const basic = employeesData[idx][7];
    for (let m = 0; m < 2; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const bonus = m === 0 ? Math.round(basic * 0.05) : 0;
      const deduction = Math.round(basic * 0.02);
      const net = basic + bonus - deduction;
      const status = m === 0 ? "pending" : "paid";
      payrollRows.push({
        employeeId: empId,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        basic, bonus, deduction, net, status,
        paidOn: status === "paid" ? fmtDate(d) : null,
      });
    }
  }
  await db.insert(payroll).values(payrollRows);

  // 10. Finance — transactions & invoices (not department-scoped, SUPER_ADMIN-only feature)
  const totalSalaries = employeesData.reduce((s, e) => s + e[7], 0);
  function daysAgo(n: number) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return fmtDate(d);
  }
  const txSamples: [string, string, string, number, string, string][] = [
    ["income", "sales", "Payment from Padma Trading Ltd.", 220000, daysAgo(3), "bank"],
    ["income", "sales", "Payment from Green Delta Textiles", 150000, daysAgo(10), "bank"],
    ["income", "sales", "Payment from Bengal Agro Exports", 95000, daysAgo(20), "mobile_banking"],
    ["income", "sales", "Payment from Dhaka Digital Solutions", 180000, daysAgo(35), "bank"],
    ["income", "sales", "Payment from Chittagong Steel Works", 130000, daysAgo(48), "bank"],
    ["expense", "salaries", "Monthly salary disbursement", totalSalaries, daysAgo(2), "bank"],
    ["expense", "salaries", "Monthly salary disbursement", totalSalaries, daysAgo(32), "bank"],
    ["expense", "rent", "Office rent — Gulshan branch", 45000, daysAgo(1), "bank"],
    ["expense", "rent", "Office rent — Gulshan branch", 45000, daysAgo(31), "bank"],
    ["expense", "utilities", "Electricity & water bill", 14500, daysAgo(5), "cash"],
    ["expense", "utilities", "Electricity & water bill", 12800, daysAgo(36), "cash"],
    ["expense", "marketing", "Facebook & Google ad campaign", 28000, daysAgo(15), "card"],
    ["expense", "marketing", "Print media & signage", 16000, daysAgo(42), "cash"],
    ["expense", "software", "SaaS subscriptions (Slack, Notion, AWS)", 22000, daysAgo(8), "card"],
    ["expense", "software", "SaaS subscriptions (Slack, Notion, AWS)", 20500, daysAgo(38), "card"],
  ];
  await db.insert(transactions).values(
    // Ledger types (lib/finance.ts): income -> cash_in, salary expenses -> salary.
    txSamples.map(([type, category, description, amount, date, method]) => ({
      type: type === "income" ? "cash_in" : category === "salaries" ? "salary" : type,
      category: category === "sales" ? "Client" : category === "salaries" ? "Salary" : category.charAt(0).toUpperCase() + category.slice(1),
      description, amount, date, method,
      account: method === "bank" ? "City Bank" : method === "mobile_banking" ? "bKash" : method === "card" ? "Card" : "Cash",
      createdAt: now.toISOString(),
    }))
  );

  const invoiceSamples: [string, string, string, number, string, string, string, string][] = [
    ["INV-10000001", "Padma Trading Ltd.", "accounts@padmatrading.com", 220000, daysAgo(30), daysAgo(2), "paid", "Q2 consulting services"],
    ["INV-10000002", "Green Delta Textiles", "finance@greendeltatex.com", 150000, daysAgo(20), daysAgo(-10), "unpaid", "Website & POS integration"],
    ["INV-10000003", "Bengal Agro Exports", "billing@bengalagro.com", 95000, daysAgo(45), daysAgo(15), "unpaid", "Overdue — inventory system support"],
    ["INV-10000004", "Dhaka Digital Solutions", "accounts@dhakadigital.io", 180000, daysAgo(15), daysAgo(-15), "paid", "Cloud migration project"],
    ["INV-10000005", "Chittagong Steel Works", "info@ctgsteel.com", 60000, daysAgo(5), daysAgo(-25), "unpaid", "Annual IT support retainer"],
    ["INV-10000006", "Sylhet Tea Traders", "office@sylhettea.com", 35000, daysAgo(10), daysAgo(-20), "unpaid", "Branding & marketing assets"],
  ];
  await db.insert(invoices).values(
    invoiceSamples.map(([invoiceNo, clientName, clientEmail, amount, issueDate, dueDate, status, notes]) => ({
      invoiceNo, clientName, clientEmail, amount, issueDate, dueDate, status, notes, createdAt: now.toISOString(),
    }))
  );

  // 11. Projects — client & agency work. Dates are relative to today so the seed always has
  // a realistic mix of finished, running, upcoming, short-term and long-term projects.
  const projectSamples: [string, string, string, "client" | "agency", string, number, string, string | null, string, number | null, number | null][] = [
    ["Padma ERP rollout", "Inventory, sales & accounting modules", "Padma Trading Ltd.", "client", "accounts@padmatrading.com", 1850000, daysAgo(240), daysAgo(-180), "active", engId, empIds[0]],
    ["Green Delta e-commerce site", "Storefront + bKash/Nagad checkout", "Green Delta Textiles", "client", "finance@greendeltatex.com", 650000, daysAgo(60), daysAgo(-60), "active", engId, empIds[1]],
    ["Cloud migration", "Move on-prem servers to AWS", "Dhaka Digital Solutions", "client", "accounts@dhakadigital.io", 420000, daysAgo(150), daysAgo(20), "completed", engId, empIds[2]],
    ["Annual IT support retainer", "Ongoing helpdesk & maintenance", "Chittagong Steel Works", "client", "info@ctgsteel.com", 720000, daysAgo(300), null, "active", engId, empIds[0]],
    ["Eid campaign 2026", "Social + OOH campaign via agency partner", "Blue Ocean Media", "agency", "projects@blueocean.com.bd", 380000, daysAgo(90), daysAgo(30), "completed", marketingId, empIds[4]],
    ["Brand refresh", "Logo, guidelines & packaging", "Sylhet Tea Traders", "client", "office@sylhettea.com", 290000, daysAgo(20), daysAgo(-70), "active", designId, empIds[6]],
    ["Mobile app UX overhaul", "White-label work for agency client", "Pixel Forge Agency", "agency", "hello@pixelforge.io", 540000, daysAgo(-15), daysAgo(-260), "planned", designId, empIds[7]],
    ["Lead-gen retainer", "Monthly performance marketing", "Growthly Partners", "agency", "ops@growthly.co", 960000, daysAgo(120), daysAgo(-300), "on_hold", marketingId, empIds[3]],
    ["Bengal Agro export portal", "Buyer portal & shipment tracking", "Bengal Agro Exports", "client", "billing@bengalagro.com", 310000, daysAgo(70), daysAgo(-20), "cancelled", engId, null],
  ];
  // One client record per distinct client/agency, with contact details; projects link to them.
  const clientContacts: Record<string, [string, string, string]> = {
    "Padma Trading Ltd.": ["Mizanur Rahman", "+880 1711-300101", "Motijheel C/A, Dhaka"],
    "Green Delta Textiles": ["Shirin Akhter", "+880 1711-300102", "Ashulia, Savar"],
    "Dhaka Digital Solutions": ["Arif Hossain", "+880 1711-300103", "Banani, Dhaka"],
    "Chittagong Steel Works": ["Jahangir Alam", "+880 1811-300104", "Agrabad, Chattogram"],
    "Blue Ocean Media": ["Tasnim Hasan", "+880 1911-300105", "Gulshan 2, Dhaka"],
    "Sylhet Tea Traders": ["Abdul Quddus", "+880 1711-300106", "Zindabazar, Sylhet"],
    "Pixel Forge Agency": ["Nadia Karim", "+880 1611-300107", "Dhanmondi, Dhaka"],
    "Growthly Partners": ["Rakib Hasan", "+880 1511-300108", "Mohakhali, Dhaka"],
    "Bengal Agro Exports": ["Salma Begum", "+880 1711-300109", "Khulna"],
  };
  const uniqueClients = [...new Map(projectSamples.map((p) => [p[2], { name: p[2], type: p[3], email: p[4] }])).values()];
  const clientRows = await db.insert(clients).values(
    uniqueClients.map((c) => {
      const [contactPerson, phone, address] = clientContacts[c.name] ?? ["", "", ""];
      return { ...c, contactPerson, phone, address, notes: "", createdAt: now.toISOString() };
    })
  ).returning({ id: clients.id, name: clients.name });
  const clientIdByName = new Map(clientRows.map((c) => [c.name, c.id]));

  await db.insert(projects).values(
    projectSamples.map(([name, description, clientName, clientType, clientEmail, value, startDate, endDate, status, departmentId, managerId]) => ({
      name, description, clientId: clientIdByName.get(clientName)!, clientName, clientType, clientEmail, value, startDate, endDate, status, departmentId, managerId,
      createdAt: now.toISOString(),
    }))
  );

  console.log("Seed complete:", { departments: deptRows.length, employees: empIds.length, users: userRows.length, permissions: PERMISSION_SEED.length, projects: projectSamples.length, clients: clientRows.length });
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
