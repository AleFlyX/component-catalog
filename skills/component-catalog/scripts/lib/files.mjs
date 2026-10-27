import fs from "node:fs";
import path from "node:path";

// Keep discovery, extraction and snapshot inputs aligned across supported source formats.
export const isSourceFile = (file) => /\.[jt]sx?$/.test(file) && !file.endsWith(".d.ts");
export const isJavaScript = (file) => /\.jsx?$/.test(file);

export function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Best effort cleanup; preserve the original write error.
    }
    throw error;
  }
}
