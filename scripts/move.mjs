import { spawnSync } from "node:child_process";

const action = process.argv[2];
if (!["compile", "test"].includes(action)) throw new Error("Supported actions: compile, test");
const executable = process.env.APTOS_CLI || "aptos";
const requestedPackage = process.argv[3];
const packages = requestedPackage
  ? [`move/${requestedPackage}`]
  : ["move/launchpad", "move/marketplace"];
for (const packageDir of packages) {
  // Explicit dev mode uses Move.toml dev-addresses; this script cannot publish.
  const result = spawnSync(executable, ["move", action, "--package-dir", packageDir, "--dev"], { stdio: "inherit" });
  if (result.error) {
    console.error("Aptos CLI could not start. Install the official CLI and set APTOS_CLI if needed.");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
