import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const paths = ["backend/api/generated", "backend/src/generated", "frontend/src/generated"];
const snapshot = () => {
  const files = execFileSync("git", ["ls-files", "-z", "--", ...paths], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const hashes = files.map(
    (file) => `${file} ${createHash("sha256").update(readFileSync(file)).digest("hex")}`,
  );
  const status = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", ...paths],
    { encoding: "utf8" },
  );
  return JSON.stringify({ hashes, status });
};
const before = snapshot();
for (const args of [
  ["--dir", "backend", "generate"],
  ["--dir", "frontend", "generate"],
]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (snapshot() !== before) {
  console.error("Generated files are out of date. Run the generators and commit their output.");
  process.exit(1);
}
