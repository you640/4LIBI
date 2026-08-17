import pg from "pg";

const connectionString =
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";

const client = new pg.Client({ connectionString });
await client.connect();

const existing = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  ["forenzdetectiv"]
);

if (existing.rowCount === 0) {
  await client.query("CREATE DATABASE forenzdetectiv");
  console.log("created forenzdetectiv");
} else {
  console.log("forenzdetectiv exists");
}

await client.end();
