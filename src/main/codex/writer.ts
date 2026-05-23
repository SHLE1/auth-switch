import fs from "node:fs";
import path from "node:path";

export function atomicWrite(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const tmp = path.join(dir, `${path.basename(targetPath)}.tmp.${process.pid}.${Date.now()}`);
  let renamed = false;

  try {
    fs.writeFileSync(tmp, content, { encoding: "utf-8", mode: 0o600 });
    if (process.platform !== "win32") {
      fs.chmodSync(tmp, 0o600);
    }

    if (process.platform === "win32" && fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    fs.renameSync(tmp, targetPath);
    renamed = true;
  } finally {
    if (!renamed && fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}
