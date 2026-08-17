import { execSync } from "node:child_process";

const ports = process.argv.slice(2).map(Number).filter(Boolean);
if (ports.length === 0) {
  ports.push(5175, 5176);
}

function listeningPids(port) {
  const out = execSync("netstat -ano", { encoding: "utf8" });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const parts = line.trim().split(/\s+/);
    const local = parts[1] ?? "";
    const pid = parts.at(-1);
    if (local.endsWith(`:${port}`) && pid && pid !== "0") {
      pids.add(pid);
    }
  }
  return [...pids];
}

for (const port of ports) {
  for (const pid of listeningPids(port)) {
    console.log(`[dev] freeing :${port} (pid ${pid})`);
    try {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: "inherit" });
    } catch {
      /* already gone */
    }
  }
}
