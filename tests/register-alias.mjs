import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const relativePath = specifier.slice(2);
      const resolvedPath = path.join(root, "src", relativePath);
      const filePath = existsSync(resolvedPath)
        ? resolvedPath
        : `${resolvedPath}.ts`;

      return nextResolve(pathToFileURL(filePath).href, context);
    }

    return nextResolve(specifier, context);
  },
});
