import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export async function writeUtf8FileAtomically(filePath: string, contents: string): Promise<void> {
  const directory = dirname(filePath);
  const temporary = join(directory, `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, contents, "utf8");
    await rename(temporary, filePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
