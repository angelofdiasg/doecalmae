import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "dist");
const apiBaseUrl = process.env.CALMAE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("CALMAE_API_BASE_URL is required to build the front-end.");
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiBaseUrl);
} catch {
  throw new Error("CALMAE_API_BASE_URL must be a valid HTTPS origin.");
}

if (
  parsedApiUrl.protocol !== "https:"
  || parsedApiUrl.origin !== apiBaseUrl
  || parsedApiUrl.username
  || parsedApiUrl.password
  || parsedApiUrl.search
  || parsedApiUrl.hash
) {
  throw new Error("CALMAE_API_BASE_URL must be an HTTPS origin with no path, credentials, query, or fragment.");
}

const indexPath = resolve(projectRoot, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const apiMetaPattern = /<meta name="calmae-api-base-url" content="">/;

if (!apiMetaPattern.test(indexHtml)) {
  throw new Error("Could not find the empty calmae-api-base-url meta tag in index.html.");
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, "index.html"),
  indexHtml.replace(apiMetaPattern, `<meta name="calmae-api-base-url" content="${parsedApiUrl.origin}">`),
);
await cp(resolve(projectRoot, "src"), resolve(outputDirectory, "src"), { recursive: true });
await cp(resolve(projectRoot, "assets"), resolve(outputDirectory, "assets"), { recursive: true });

console.log(`Front-end built for API origin ${parsedApiUrl.origin}.`);
