import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHECK_EXTENSIONS = new Set([".css", ".json", ".md", ".ts", ".tsx"]);
const SKIP_DIRECTORIES = new Set([".git", ".next", "data", "node_modules"]);
const MOJIBAKE_PATTERNS = [
  /\uFFFD/u,
  /[ìíîï][\u0080-\u00bf]/u,
  /[êë][\u0080-\u00bf]/u,
  /[àáâã][\u0080-\u00bf]/u,
  /[�]/u,
  /[吏愿媛濡]/u,
];

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return SKIP_DIRECTORIES.has(entry.name) ? [] : walk(fullPath);
    }

    return CHECK_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const failures = [];

for (const filePath of walk(ROOT)) {
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString("utf8");

  if (text.charCodeAt(0) === 0xfeff) {
    failures.push([filePath, "UTF-8 BOM"]);
  }

  if (text.includes("\u0000")) {
    failures.push([filePath, "NUL byte"]);
  }

  if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(text))) {
    failures.push([filePath, "likely mojibake"]);
  }
}

if (failures.length > 0) {
  console.error("Encoding check failed:");
  for (const [filePath, reason] of failures) {
    console.error(`- ${path.relative(ROOT, filePath)}: ${reason}`);
  }
  process.exit(1);
}

console.log("Encoding check passed.");
