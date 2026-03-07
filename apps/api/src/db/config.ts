const supportedDatabaseDialects = ["postgres", "sqlite"] as const;

export type DatabaseDialect = (typeof supportedDatabaseDialects)[number];

function isSqliteUrl(value: string) {
  return (
    value === ":memory:" ||
    value.startsWith("sqlite:") ||
    value.startsWith("file:") ||
    value.endsWith(".sqlite") ||
    value.endsWith(".db") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/")
  );
}

function isPostgresUrl(value: string) {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

function normalizeSqliteUrl(value: string) {
  switch (true) {
    case value === ":memory:":
      return value;
    case value.startsWith("sqlite:"):
    case value.startsWith("file:"):
      return value;
    default:
      return `file:${value}`;
  }
}

function readDatabaseDialect(
  dialectValue: string | undefined,
  urlValue: string | undefined,
): DatabaseDialect {
  if (dialectValue === undefined) {
    if (urlValue === undefined) {
      return "sqlite";
    }

    if (isPostgresUrl(urlValue)) {
      return "postgres";
    }

    if (isSqliteUrl(urlValue)) {
      return "sqlite";
    }

    throw new Error(
      `Could not infer database dialect from DATABASE_URL: ${urlValue}. Set DATABASE_DIALECT explicitly.`,
    );
  }

  if (supportedDatabaseDialects.includes(dialectValue as DatabaseDialect)) {
    return dialectValue as DatabaseDialect;
  }

  throw new Error(
    `Unsupported DATABASE_DIALECT: ${dialectValue}. Expected one of ${supportedDatabaseDialects.join(", ")}.`,
  );
}

export const databaseDialect = readDatabaseDialect(
  process.env.DATABASE_DIALECT,
  process.env.DATABASE_URL,
);

function readDatabaseUrl() {
  if (databaseDialect === "sqlite") {
    return normalizeSqliteUrl(process.env.DATABASE_URL ?? "file:./kang.sqlite");
  }

  return (
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/kang"
  );
}

export const databaseUrl = readDatabaseUrl();
