import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:@localhost:3306/officehub";
// mysql2 doesn't understand the `ssl-mode=REQUIRED` query param managed hosts (e.g. Aiven) put
// in their connection URIs — it has to be passed as an explicit `ssl` option instead.
const needsSSL = /ssl-?mode=REQUIRED/i.test(DATABASE_URL);

const pool =
  global._mysqlPool ??
  mysql.createPool({
    uri: DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
