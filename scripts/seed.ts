import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:@localhost:3306/officehub";
// mysql2 doesn't understand the `ssl-mode=REQUIRED` query param managed hosts (e.g. Aiven) put
// in their connection URIs — it has to be passed as an explicit `ssl` option instead.
const needsSSL = /ssl-?mode=REQUIRED/i.test(DATABASE_URL);

async function main() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(191) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      employee_id INT,
      created_at VARCHAR(64) NOT NULL DEFAULT ''
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      description VARCHAR(512) DEFAULT '',
      color VARCHAR(16) DEFAULT '#6C5DD3',
      head_employee_id INT,
      budget DOUBLE NOT NULL DEFAULT 0
    )
  `);
  // existing installs predate these columns — CREATE TABLE IF NOT EXISTS above is a no-op for them
  const [deptCols]: any = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments'`
  );
  const deptColNames = deptCols.map((c: any) => c.COLUMN_NAME);
  if (!deptColNames.includes("head_employee_id")) {
    await connection.query(`ALTER TABLE departments ADD COLUMN head_employee_id INT`);
  }
  if (!deptColNames.includes("budget")) {
    await connection.query(`ALTER TABLE departments ADD COLUMN budget DOUBLE NOT NULL DEFAULT 0`);
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      phone VARCHAR(32) DEFAULT '',
      position VARCHAR(191) NOT NULL,
      department_id INT,
      join_date VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      avatar_color VARCHAR(16) DEFAULT '#6C5DD3',
      base_salary DOUBLE NOT NULL DEFAULT 0,
      address VARCHAR(512) DEFAULT ''
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      date VARCHAR(16) NOT NULL,
      check_in VARCHAR(16),
      check_out VARCHAR(16),
      status VARCHAR(16) NOT NULL DEFAULT 'present',
      approval_status VARCHAR(16) NOT NULL DEFAULT 'approved'
    )
  `);
  {
    const [cols]: any = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance'`
    );
    const colNames = cols.map((c: any) => c.COLUMN_NAME);
    if (!colNames.includes("approval_status")) {
      await connection.query(`ALTER TABLE attendance ADD COLUMN approval_status VARCHAR(16) NOT NULL DEFAULT 'approved'`);
    }
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS leaves (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      type VARCHAR(16) NOT NULL,
      start_date VARCHAR(16) NOT NULL,
      end_date VARCHAR(16) NOT NULL,
      reason VARCHAR(512) DEFAULT '',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      applied_on VARCHAR(64) NOT NULL
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payroll (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      month INT NOT NULL,
      year INT NOT NULL,
      basic DOUBLE NOT NULL,
      bonus DOUBLE NOT NULL DEFAULT 0,
      deduction DOUBLE NOT NULL DEFAULT 0,
      net DOUBLE NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      paid_on VARCHAR(16)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT,
      name VARCHAR(191) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'general',
      upload_date VARCHAR(16) NOT NULL,
      size VARCHAR(32) DEFAULT '—'
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(191) NOT NULL,
      description TEXT,
      assignee_id INT,
      due_date VARCHAR(16),
      priority VARCHAR(16) NOT NULL DEFAULT 'medium',
      status VARCHAR(16) NOT NULL DEFAULT 'todo',
      created_at VARCHAR(64) NOT NULL
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(16) NOT NULL,
      category VARCHAR(64) NOT NULL,
      description VARCHAR(255) DEFAULT '',
      amount DOUBLE NOT NULL,
      date VARCHAR(16) NOT NULL,
      method VARCHAR(32) DEFAULT 'bank',
      created_at VARCHAR(64) NOT NULL
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_no VARCHAR(32) NOT NULL UNIQUE,
      client_name VARCHAR(191) NOT NULL,
      client_email VARCHAR(191) DEFAULT '',
      amount DOUBLE NOT NULL,
      issue_date VARCHAR(16) NOT NULL,
      due_date VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'unpaid',
      notes VARCHAR(512) DEFAULT '',
      created_at VARCHAR(64) NOT NULL
    )
  `);

  // wipe existing data for a clean reseed (respect FK-ish ordering)
  for (const t of ["invoices", "transactions", "tasks", "documents", "payroll", "leaves", "attendance", "employees", "departments", "users"]) {
    await connection.query(`DELETE FROM ${t}`);
    await connection.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
  }

  const depts: [string, string, string][] = [
    ["Engineering", "Product & platform engineering", "#6C5DD3"],
    ["Design", "Product & brand design", "#3DB2FF"],
    ["Marketing", "Growth & communications", "#F6A723"],
    ["Human Resources", "People operations", "#1DBF73"],
    ["Sales", "Client acquisition & accounts", "#F45252"],
  ];
  const deptIds: number[] = [];
  for (const d of depts) {
    const [r]: any = await connection.query(`INSERT INTO departments (name, description, color) VALUES (?, ?, ?)`, d);
    deptIds.push(r.insertId);
  }

  const colors = ["#6C5DD3", "#3DB2FF", "#F6A723", "#1DBF73", "#F45252", "#8B5CF6", "#EC4899"];
  const employeesData: [string, string, string, string, number, string, string, number][] = [
    ["Ayesha Rahman", "ayesha.rahman@officehub.io", "+880 1711-000111", "Senior Software Engineer", deptIds[0], "2022-03-14", "active", 68000],
    ["Tanvir Ahmed", "tanvir.ahmed@officehub.io", "+880 1711-000112", "Frontend Developer", deptIds[0], "2023-01-09", "active", 52000],
    ["Nusrat Jahan", "nusrat.jahan@officehub.io", "+880 1711-000113", "UI/UX Designer", deptIds[1], "2021-11-02", "active", 55000],
    ["Rafiul Islam", "rafiul.islam@officehub.io", "+880 1711-000114", "Product Designer", deptIds[1], "2023-06-20", "on_leave", 50000],
    ["Sadia Akter", "sadia.akter@officehub.io", "+880 1711-000115", "Marketing Manager", deptIds[2], "2020-08-11", "active", 60000],
    ["Mahin Chowdhury", "mahin.chowdhury@officehub.io", "+880 1711-000116", "Content Strategist", deptIds[2], "2024-02-05", "active", 42000],
    ["Farzana Yasmin", "farzana.yasmin@officehub.io", "+880 1711-000117", "HR Manager", deptIds[3], "2019-05-19", "active", 58000],
    ["Imran Kabir", "imran.kabir@officehub.io", "+880 1711-000118", "Recruiter", deptIds[3], "2023-09-01", "active", 40000],
    ["Sabbir Hossain", "sabbir.hossain@officehub.io", "+880 1711-000119", "Sales Executive", deptIds[4], "2022-12-15", "active", 45000],
    ["Nabila Islam", "nabila.islam@officehub.io", "+880 1711-000120", "Account Manager", deptIds[4], "2021-07-23", "inactive", 47000],
    ["Kamrul Hasan", "kamrul.hasan@officehub.io", "+880 1711-000121", "Backend Engineer", deptIds[0], "2023-04-18", "active", 63000],
    ["Rima Sultana", "rima.sultana@officehub.io", "+880 1711-000122", "QA Engineer", deptIds[0], "2024-01-22", "active", 44000],
  ];
  const empIds: number[] = [];
  for (const [i, e] of employeesData.entries()) {
    const [name, email, phone, position, departmentId, joinDate, status, baseSalary] = e;
    const [r]: any = await connection.query(
      `INSERT INTO employees (name, email, phone, position, department_id, join_date, status, avatar_color, base_salary, address) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [name, email, phone, position, departmentId, joinDate, status, colors[i % colors.length], baseSalary, "Dhaka, Bangladesh"]
    );
    empIds.push(r.insertId);
  }

  const deptHeads: [number, number, number][] = [
    [deptIds[0], empIds[0], 400000], // Engineering — Ayesha Rahman (Senior Software Engineer)
    [deptIds[1], empIds[2], 180000], // Design — Nusrat Jahan (UI/UX Designer)
    [deptIds[2], empIds[4], 200000], // Marketing — Sadia Akter (Marketing Manager)
    [deptIds[3], empIds[6], 150000], // Human Resources — Farzana Yasmin (HR Manager)
    [deptIds[4], empIds[8], 170000], // Sales — Sabbir Hossain (Sales Executive)
  ];
  for (const [deptId, headEmployeeId, budget] of deptHeads) {
    await connection.query(`UPDATE departments SET head_employee_id = ?, budget = ? WHERE id = ?`, [headEmployeeId, budget, deptId]);
  }

  const adminPass = await bcrypt.hash("admin123", 10);
  const hrPass = await bcrypt.hash("password123", 10);
  await connection.query(`INSERT INTO users (name, email, password, role, employee_id, created_at) VALUES (?,?,?,?,?,?)`,
    ["Admin User", "admin@officehub.io", adminPass, "admin", null, new Date().toISOString()]);
  await connection.query(`INSERT INTO users (name, email, password, role, employee_id, created_at) VALUES (?,?,?,?,?,?)`,
    ["Farzana Yasmin", "farzana.yasmin@officehub.io", hrPass, "hr", empIds[6], new Date().toISOString()]);

  // self-service logins for every other employee — same shared password, own email
  const employeePass = await bcrypt.hash("employee123", 10);
  for (const [i, empId] of empIds.entries()) {
    if (empId === empIds[6]) continue; // Farzana already has an HR login
    const [name, email] = employeesData[i];
    await connection.query(`INSERT INTO users (name, email, password, role, employee_id, created_at) VALUES (?,?,?,?,?,?)`,
      [name, email, employeePass, "employee", empId, new Date().toISOString()]);
  }

  function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
  const today = new Date();
  for (const empId of empIds) {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const day = d.getDay();
      if (day === 5 || day === 6) continue; // Fri/Sat weekend (BD)
      const roll = Math.random();
      let status = "present", checkIn: string | null = "09:0" + Math.floor(Math.random() * 9), checkOut: string | null = "18:0" + Math.floor(Math.random() * 9);
      if (roll < 0.06) { status = "absent"; checkIn = null; checkOut = null; }
      else if (roll < 0.16) { status = "late"; checkIn = "10:1" + Math.floor(Math.random() * 5); }
      await connection.query(`INSERT INTO attendance (employee_id, date, check_in, check_out, status) VALUES (?,?,?,?,?)`,
        [empId, fmtDate(d), checkIn, checkOut, status]);
    }
  }

  // a couple of self-submitted, not-yet-approved entries to demo the approval flow
  const pendingAttendance: [number, string][] = [
    [empIds[1], "09:05"], // Tanvir Ahmed
    [empIds[11], "09:12"], // Rima Sultana
  ];
  for (const [empId, checkIn] of pendingAttendance) {
    await connection.query(`INSERT INTO attendance (employee_id, date, check_in, check_out, status, approval_status) VALUES (?,?,?,?,?,?)`,
      [empId, fmtDate(today), checkIn, null, "present", "pending"]);
  }

  const leaveSamples: [number, string, string, string, string, string][] = [
    [empIds[3], "annual", "2026-08-05", "2026-08-09", "Family trip to Sylhet", "pending"],
    [empIds[1], "sick", "2026-07-28", "2026-07-29", "Fever", "approved"],
    [empIds[5], "casual", "2026-08-12", "2026-08-12", "Personal errand", "pending"],
    [empIds[8], "sick", "2026-07-15", "2026-07-16", "Food poisoning", "approved"],
    [empIds[2], "annual", "2026-09-01", "2026-09-05", "Eid vacation", "pending"],
    [empIds[9], "unpaid", "2026-07-01", "2026-07-10", "Extended personal leave", "rejected"],
  ];
  for (const l of leaveSamples) {
    await connection.query(`INSERT INTO leaves (employee_id, type, start_date, end_date, reason, status, applied_on) VALUES (?,?,?,?,?,?,?)`,
      [...l, new Date().toISOString()]);
  }

  const now = new Date();
  for (const [idx, empId] of empIds.entries()) {
    const basic = employeesData[idx][7];
    for (let m = 0; m < 2; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const bonus = m === 0 ? Math.round(basic * 0.05) : 0;
      const deduction = Math.round(basic * 0.02);
      const net = basic + bonus - deduction;
      const status = m === 0 ? "pending" : "paid";
      await connection.query(`INSERT INTO payroll (employee_id, month, year, basic, bonus, deduction, net, status, paid_on) VALUES (?,?,?,?,?,?,?,?,?)`,
        [empId, d.getMonth() + 1, d.getFullYear(), basic, bonus, deduction, net, status, status === "paid" ? fmtDate(d) : null]);
    }
  }

  const docSamples: [number, string, string, string][] = [
    [empIds[0], "Employment Contract.pdf", "contract", "300 KB"],
    [empIds[0], "NID Copy.pdf", "id", "120 KB"],
    [empIds[2], "Design Certification.pdf", "certificate", "540 KB"],
    [empIds[6], "HR Policy Handbook.pdf", "general", "1.1 MB"],
    [empIds[9], "Resignation Letter.pdf", "contract", "90 KB"],
    [empIds[4], "Marketing Certification.pdf", "certificate", "410 KB"],
  ];
  for (const [empId, name, category, size] of docSamples) {
    await connection.query(`INSERT INTO documents (employee_id, name, category, upload_date, size) VALUES (?,?,?,?,?)`,
      [empId, name, category, fmtDate(new Date()), size]);
  }

  const taskSamples: [string, string, number, string, string, string][] = [
    ["Finalize Q3 hiring plan", "Coordinate with department heads on headcount", empIds[6], "2026-08-10", "high", "in_progress"],
    ["Prepare payroll report", "Compile July payroll summary for finance", empIds[6], "2026-08-06", "high", "todo"],
    ["Onboard new backend engineer", "Setup accounts, laptop, and orientation", empIds[7], "2026-08-08", "medium", "todo"],
    ["Update employee handbook", "Add new remote work policy section", empIds[6], "2026-08-20", "low", "todo"],
    ["Design new dashboard icons", "Icon set for HR management redesign", empIds[2], "2026-08-07", "medium", "in_progress"],
    ["Review leave requests", "Approve/reject pending leave applications", empIds[6], "2026-08-05", "high", "done"],
  ];
  for (const [title, description, assigneeId, dueDate, priority, status] of taskSamples) {
    await connection.query(`INSERT INTO tasks (title, description, assignee_id, due_date, priority, status, created_at) VALUES (?,?,?,?,?,?,?)`,
      [title, description, assigneeId, dueDate, priority, status, new Date().toISOString()]);
  }

  const totalSalaries = employeesData.reduce((s, e) => s + e[7], 0);
  function daysAgo(n: number) { const d = new Date(now); d.setDate(d.getDate() - n); return fmtDate(d); }
  const txSamples: [string, string, string, number, string, string][] = [
    // income — client payments
    ["income", "sales", "Payment from Padma Trading Ltd.", 220000, daysAgo(3), "bank"],
    ["income", "sales", "Payment from Green Delta Textiles", 150000, daysAgo(10), "bank"],
    ["income", "sales", "Payment from Bengal Agro Exports", 95000, daysAgo(20), "mobile_banking"],
    ["income", "sales", "Payment from Dhaka Digital Solutions", 180000, daysAgo(35), "bank"],
    ["income", "sales", "Payment from Chittagong Steel Works", 130000, daysAgo(48), "bank"],
    // expenses — recurring & operational
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
  for (const [type, category, description, amount, date, method] of txSamples) {
    await connection.query(`INSERT INTO transactions (type, category, description, amount, date, method, created_at) VALUES (?,?,?,?,?,?,?)`,
      [type, category, description, amount, date, method, new Date().toISOString()]);
  }

  const invoiceSamples: [string, string, string, number, string, string, string, string][] = [
    ["INV-10000001", "Padma Trading Ltd.", "accounts@padmatrading.com", 220000, daysAgo(30), daysAgo(2), "paid", "Q2 consulting services"],
    ["INV-10000002", "Green Delta Textiles", "finance@greendeltatex.com", 150000, daysAgo(20), daysAgo(-10), "unpaid", "Website & POS integration"],
    ["INV-10000003", "Bengal Agro Exports", "billing@bengalagro.com", 95000, daysAgo(45), daysAgo(15), "unpaid", "Overdue — inventory system support"],
    ["INV-10000004", "Dhaka Digital Solutions", "accounts@dhakadigital.io", 180000, daysAgo(15), daysAgo(-15), "paid", "Cloud migration project"],
    ["INV-10000005", "Chittagong Steel Works", "info@ctgsteel.com", 60000, daysAgo(5), daysAgo(-25), "unpaid", "Annual IT support retainer"],
    ["INV-10000006", "Sylhet Tea Traders", "office@sylhettea.com", 35000, daysAgo(10), daysAgo(-20), "unpaid", "Branding & marketing assets"],
  ];
  for (const [invoiceNo, clientName, clientEmail, amount, issueDate, dueDate, status, notes] of invoiceSamples) {
    await connection.query(`INSERT INTO invoices (invoice_no, client_name, client_email, amount, issue_date, due_date, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [invoiceNo, clientName, clientEmail, amount, issueDate, dueDate, status, notes, new Date().toISOString()]);
  }

  console.log("Seed complete:", { departments: deptIds.length, employees: empIds.length });
  await connection.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
});
