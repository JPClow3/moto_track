import postgres from "postgres";

/** Explicit CI branch/host opt-in; never guess a database from browser state. */
export async function openDisposableDb() {
  const branch = process.env.E2E_DISPOSABLE_BRANCH ?? "";
  const expectedHost = process.env.E2E_DISPOSABLE_DATABASE_HOST ?? "";
  const connection =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const base =
    process.env.E2E_BASE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "http://localhost:5187";
  const email = process.env.E2E_USER_EMAIL;
  let databaseUrl: URL;
  let appUrl: URL;
  try {
    databaseUrl = new URL(connection ?? "");
    appUrl = new URL(base);
  } catch {
    throw new Error(
      "Disposable E2E requires explicit database and local app URLs.",
    );
  }
  if (
    !/^br-[a-z0-9-]+$/.test(branch) ||
    !expectedHost ||
    !expectedHost.endsWith(".neon.tech") ||
    databaseUrl.hostname !== expectedHost ||
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !["http:", "https:"].includes(appUrl.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname) ||
    !email
  ) {
    throw new Error(
      "Disposable E2E guard failed: require a br- branch, matching declared Neon host, localhost app and dedicated account email.",
    );
  }
  const sql = postgres(connection!, {
    ssl: "require",
    prepare: false,
    max: 1,
    connect_timeout: 5,
  });
  try {
    const [owner] = await sql<Array<{ id: string; email_verified: boolean }>>`
      select p.id, u."emailVerified" as email_verified from profiles p join neon_auth."user" u on u.id = p.id
      where lower(p.email) = lower(${email}) and lower(u.email) = lower(${email})
    `;
    if (!owner)
      throw new Error(
        "Disposable E2E dedicated test account identity was not found.",
      );
    return {
      sql,
      ownerId: owner.id,
      emailVerified: owner.email_verified,
      close: () => sql.end({ timeout: 5 }),
    };
  } catch (cause) {
    await sql.end({ timeout: 5 });
    throw cause;
  }
}
