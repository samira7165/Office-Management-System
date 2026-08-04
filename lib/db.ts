import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

const pool =
  global._mysqlPool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL || "mysql://root:@localhost:3306/officehub",
    waitForConnections: true,
    connectionLimit: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global._mysqlPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
