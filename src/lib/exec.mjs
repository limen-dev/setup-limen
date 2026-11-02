import { spawn } from "node:child_process";

// Run a program with an argument list (never a shell) and collect what it prints.
// `stream` copies the output to the job log as it arrives.
export function exec(command, args, { env, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stream) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stream) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
