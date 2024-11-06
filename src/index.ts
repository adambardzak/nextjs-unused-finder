import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, dirname, extname, join, relative } from "path";
import chalk from "chalk";

type FileType =
  | "media"
  | "component"
  | "util"
  | "type"
  | "hook"
  | "context"
  | "style"
  | "api"
  | "page";

interface UnusedFile {
  path: string;
  size: number;
  type: FileType;
  reason?: string;
}

interface ImportInfo {
  imports: Set<string>;
  exports: Set<string>;
  content: string;
  filePath: string;
}

const NEXTJS_PATTERNS = {
  criticalFiles: new Set([
    "layout.tsx",
    "page.tsx",
    "loading.tsx",
    "error.tsx",
    "not-found.tsx",
    "route.ts",
    "middleware.ts",
    "robots.ts",
    "sitemap.ts",
    "manifest.ts",
    "global.d.ts",
    "globals.css",
    "analytics.ts",
    "metadata.ts",
    "schema.js",
  ]),

  specialDirs: new Set([
    "api",
    "app",
    "_components",
    "utils",
    "lib",
    "hooks",
    "contexts",
  ]),

  ignoredPaths: new Set([
    "node_modules",
    ".next",
    "dist",
    ".git",
    ".husky",
    "public/chunks",
    "public/static",
  ]),

  mediaExtensions: new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".mp4",
    ".webm",
    ".m4s",
    ".mp3",
    ".wav",
    ".ogg",
  ]),

  codeExtensions: new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".scss",
    ".sass",
    ".less",
  ]),

  apiPatterns: [
    /fetch\(['"`]\/api\/([^'"`]+)['"`]\)/g,
    /axios\.[a-z]+\(['"`]\/api\/([^'"`]+)['"`]\)/g,
    /\/api\/([a-zA-Z0-9-_/]+)/g,
  ],
};

function printHeader(): void {
  console.log("\n" + chalk.blue("━".repeat(80)));
  console.log(
    chalk.blue(`
   ╭─────────────────────────────────────────────────────╮
   │             Next.js Unused Files Finder             │
   ╰─────────────────────────────────────────────────────╯
`)
  );
}

function printSection(title: string): void {
  console.log(chalk.blue("\n┌" + "─".repeat(78) + "┐"));
  console.log(
    chalk.blue("│") + chalk.white.bold(` ${title}`.padEnd(77)) + chalk.blue("│")
  );
  console.log(chalk.blue("└" + "─".repeat(78) + "┘\n"));
}

function getFileEmoji(type: FileType): string {
  switch (type) {
    case "media":
      return "🖼 ";
    case "component":
      return "⚛️ ";
    case "util":
      return "🛠 ";
    case "type":
      return "📝";
    case "hook":
      return "🎣";
    case "context":
      return "🔄";
    case "style":
      return "🎨";
    case "api":
      return "🔌";
    case "page":
      return "📄";
    default:
      return "📁";
  }
}

function isNextJsSystemFile(filePath: string): boolean {
  const fileName = basename(filePath);
  const dirName = basename(dirname(filePath));

  if (NEXTJS_PATTERNS.criticalFiles.has(fileName)) {
    return true;
  }

  if (filePath.includes("/api/")) {
    return true;
  }

  if (dirName === "app" && fileName.startsWith("page.")) {
    return true;
  }

  return false;
}

function getFileType(filePath: string): FileType {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();

  if (filePath.includes("/api/")) {
    return "api";
  }

  if (filePath.includes("/app/") && fileName.startsWith("page.")) {
    return "page";
  }

  if (NEXTJS_PATTERNS.mediaExtensions.has(ext)) {
    return "media";
  }

  if (/^[A-Z].*\.(tsx|jsx)$/.test(fileName)) {
    return "component";
  }

  if (/^use[A-Z].*\.(ts|tsx)$/.test(fileName)) {
    return "hook";
  }

  if (/(Context|Provider)\.(ts|tsx)$/.test(fileName)) {
    return "context";
  }

  if (/\.d\.ts$/.test(fileName)) {
    return "type";
  }

  if (/\.(css|scss|sass|less)$/.test(fileName)) {
    return "style";
  }

  return "util";
}

function isFileUsed(file: string, importMap: Map<string, ImportInfo>): boolean {
  const fileName = basename(file);
  const fileInfo = importMap.get(file);

  if (isNextJsSystemFile(file)) {
    return true;
  }

  let isUsed = false;

  for (const [otherFile, otherInfo] of importMap.entries()) {
    if (otherFile === file) continue;

    const fileBaseName = basename(file, extname(file));
    if (otherInfo.content.includes(fileBaseName)) {
      isUsed = true;
      break;
    }

    if (file.includes("/api/")) {
      const apiPath = file.split("/api/")[1]?.replace(/\.[jt]s$/, "");
      if (
        apiPath &&
        NEXTJS_PATTERNS.apiPatterns.some((pattern) => {
          const matches = otherInfo.content.match(pattern);
          return matches && matches.some((m) => m.includes(apiPath));
        })
      ) {
        isUsed = true;
        break;
      }
    }

    if (NEXTJS_PATTERNS.mediaExtensions.has(extname(file).toLowerCase())) {
      if (otherInfo.content.includes(fileName)) {
        isUsed = true;
        break;
      }
    }
  }

  return isUsed;
}

function getAllFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  let results: string[] = [];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      if (NEXTJS_PATTERNS.ignoredPaths.has(item)) continue;

      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error reading directory ${dir}:`, error));
  }

  return results;
}

function findImports(content: string): Set<string> {
  const imports = new Set<string>();
  const importPatterns = [
    /import\s+(?:{[\s\w,]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\(['"]([^'"]+)['"]\)/g,
    /require\(['"]([^'"]+)['"]\)/g,
    /dynamic\([^)]+['"]\)/g,
  ];

  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && match[1].startsWith(".")) {
        imports.add(match[1]);
        imports.add(match[1].replace(/\.(js|jsx|ts|tsx)$/, ""));
      }
    }
  }

  return imports;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
  return chalk.bold(`${size} ${sizes[i]}`);
}

function printResults(
  unusedFiles: UnusedFile[],
  totalSize: number,
  rootDir: string
): void {
  const groupedFiles = unusedFiles.reduce((acc, file) => {
    acc[file.type] = acc[file.type] || [];
    acc[file.type].push(file);
    return acc;
  }, {} as Record<FileType, UnusedFile[]>);

  console.log(chalk.blue.bold("\n📊 Summary:"));
  console.log(
    chalk.blue("├─") +
      chalk.white(` Total files analyzed: ${unusedFiles.length}`)
  );
  console.log(
    chalk.blue("├─") +
      chalk.white(` Types of unused files: ${Object.keys(groupedFiles).length}`)
  );
  console.log(
    chalk.blue("└─") +
      chalk.white(` Potential savings: ${formatBytes(totalSize)}`)
  );

  for (const [type, files] of Object.entries(groupedFiles)) {
    if (files.length === 0) continue;

    const emoji = getFileEmoji(type as FileType);
    printSection(`${emoji} ${type.toUpperCase()} (${files.length} files)`);

    const sizeForType = files.reduce((acc, file) => acc + file.size, 0);
    console.log(chalk.gray(`Total size: ${formatBytes(sizeForType)}`));

    files.forEach((file, index) => {
      const isLast = index === files.length - 1;
      const prefix = isLast ? "└─" : "├─";
      const relativePath = relative(rootDir, file.path);
      console.log(
        chalk.blue(prefix) +
          chalk.yellow(` ${relativePath}`) +
          chalk.gray(` (${formatBytes(file.size)})`)
      );
    });
  }

  console.log("\n" + chalk.yellow("⚠️  Important Notes:"));
  console.log(chalk.gray("├─ Please verify files manually before deleting"));
  console.log(
    chalk.gray("├─ Some files might be used through dynamic imports")
  );
  console.log(
    chalk.gray("├─ API routes might be called from external sources")
  );
  console.log(
    chalk.gray("└─ Files might be used in ways not detected by this script")
  );
}

export async function findUnusedFiles(): Promise<void> {
  printHeader();

  const rootDir = process.cwd();
  const publicDir = join(rootDir, "public");
  const srcDir = join(rootDir, "src");

  console.log(chalk.blue("🔍 ") + chalk.white("Scanning project..."));

  const allFiles = getAllFiles(srcDir);
  const publicFiles = getAllFiles(publicDir);
  const sourceFiles = allFiles.filter((file) =>
    NEXTJS_PATTERNS.codeExtensions.has(extname(file).toLowerCase())
  );

  console.log(chalk.gray(`\nFound:`));
  console.log(
    chalk.blue("├─") + chalk.white(` ${sourceFiles.length} source files`)
  );
  console.log(
    chalk.blue("└─") + chalk.white(` ${publicFiles.length} public files`)
  );

  printSection("🔎 Analyzing Files");

  const importMap = new Map<string, ImportInfo>();
  const unusedFiles: UnusedFile[] = [];
  let totalSize = 0;

  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, "utf8");
      importMap.set(file, {
        imports: findImports(content),
        exports: new Set(),
        content,
        filePath: file,
      });
    } catch (error) {
      console.error(chalk.red(`Error analyzing ${file}:`, error));
    }
  }

  for (const file of sourceFiles) {
    if (!isFileUsed(file, importMap)) {
      try {
        const stats = statSync(file);
        totalSize += stats.size;
        unusedFiles.push({
          path: file,
          size: stats.size,
          type: getFileType(file),
        });
      } catch (error) {
        console.error(chalk.red(`Error getting stats for ${file}:`, error));
      }
    }
  }

  for (const file of publicFiles) {
    const fileName = basename(file);
    let isUsed = false;

    if (
      fileName === "robots.txt" ||
      fileName === "sitemap.xml" ||
      fileName.includes("segment_") ||
      fileName.endsWith(".m4s")
    ) {
      continue;
    }

    for (const [_, info] of importMap) {
      if (info.content.includes(fileName)) {
        isUsed = true;
        break;
      }
    }

    if (!isUsed) {
      try {
        const stats = statSync(file);
        totalSize += stats.size;
        unusedFiles.push({
          path: file,
          size: stats.size,
          type: "media",
        });
      } catch (error) {
        console.error(chalk.red(`Error getting stats for ${file}:`, error));
      }
    }
  }

  if (unusedFiles.length === 0) {
    console.log(chalk.green("\n✨ No unused files found!"));
    return;
  }

  printResults(unusedFiles, totalSize, rootDir);
}

// Run the script
findUnusedFiles().catch(console.error);
