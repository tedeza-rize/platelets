import type { DatabaseDialect } from "@/lib/database/types";

function postgresPlaceholders(sql: string) {
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;
  let result = "";

  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position];

    if (quote) {
      result += character;

      if (character === quote) {
        if (sql[position + 1] === quote) {
          result += sql[position + 1];
          position += 1;
        } else {
          quote = null;
        }
      }

      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      result += character;
      continue;
    }

    if (character === "?") {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += character;
  }

  return result;
}

function mysqlUpsert(sql: string) {
  const conflict = /\s+ON\s+CONFLICT\s*\([^)]*\)\s+DO\s+UPDATE\s+SET\s+/iu;

  if (!conflict.test(sql)) {
    return sql;
  }

  return sql
    .replace(conflict, " ON DUPLICATE KEY UPDATE ")
    .replace(/excluded\.([a-z_][a-z0-9_]*)/giu, "VALUES($1)");
}

export function databaseSql(sql: string, dialect: DatabaseDialect) {
  if (dialect === "postgresql") {
    return postgresPlaceholders(sql);
  }

  if (dialect === "mysql") {
    return mysqlUpsert(sql);
  }

  return sql;
}

export function quoteIdentifier(identifier: string, dialect: DatabaseDialect) {
  if (!/^[a-z_][a-z0-9_]*$/iu.test(identifier)) {
    throw new Error("Database identifier is not allowed.");
  }

  return dialect === "mysql" ? `\`${identifier}\`` : `"${identifier}"`;
}
