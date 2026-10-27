// Serves out/ under a base path for end-to-end tests: http://localhost:4173/newsren/
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "/newsren";
const PORT = Number(process.env.PORT || 4173);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (!url.startsWith(BASE)) {
    res.writeHead(404).end("Not under base path");
    return;
  }
  let path = normalize(join("out", url.slice(BASE.length)));
  if (!path.startsWith("out")) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) {
    res.writeHead(404, { "Content-Type": "text/html" });
    createReadStream("out/404.html").pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`Serving out/ at http://localhost:${PORT}${BASE}/`));
