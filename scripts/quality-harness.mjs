import { spawn } from "node:child_process";

const steps = [
  {
    name: "lint",
    command: "npm",
    args: ["run", "lint"],
  },
  {
    name: "unit tests",
    command: "npm",
    args: ["run", "test"],
  },
  {
    name: "production build",
    command: "npm",
    args: ["run", "build"],
  },
];

const runE2e = process.env.RUN_E2E === "1" || process.env.RUN_E2E === "true";
const allowProductionE2e =
  process.env.ALLOW_PRODUCTION_E2E === "1" ||
  process.env.ALLOW_PRODUCTION_E2E === "true";
const e2eBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? "";
const productionLikeE2e =
  e2eBaseUrl.includes("offline-study-management.vercel.app") ||
  e2eBaseUrl.includes("vercel.app");

if (runE2e) {
  if (productionLikeE2e && !allowProductionE2e) {
    console.error(
      [
        "[quality:harness] Refusing to run E2E against a production-like URL.",
        "Set ALLOW_PRODUCTION_E2E=1 only when this is intentional.",
      ].join("\n")
    );
    process.exit(1);
  }

  steps.push({
    name: "user-flow tests",
    command: "npx",
    args: ["playwright", "test"],
  });
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n[quality:harness] ${step.name}`);
    const child = spawn(step.command, step.args, {
      env: process.env,
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${step.name} failed with exit code ${code}`));
    });
  });
}

for (const step of steps) {
  await runStep(step);
}

if (!runE2e) {
  console.log(
    "\n[quality:harness] Skipped user-flow tests. Set RUN_E2E=1 to run them in a safe target environment."
  );
}

console.log("\n[quality:harness] All enabled checks passed.");
