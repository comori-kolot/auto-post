import { readFile, writeFile } from "node:fs/promises";

function parseCsvLine(line) {
  return line.split(",").map((cell) => cell.trim());
}

export async function readKeywords(path) {
  const raw = await readFile(path, "utf8");
  const lines = raw.trim().split("\n");
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""]));
  });
  return { header, rows };
}

export async function writeKeywords(path, header, rows) {
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => row[key] ?? "").join(","));
  }
  await writeFile(path, lines.join("\n") + "\n", "utf8");
}
