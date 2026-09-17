// src/leanspec-fs.ts
import fs from "node:fs";
import path from "node:path";
var NO_LEANSPEC_MESSAGE = "\u5F53\u524D\u9879\u76EE\u6CA1\u6709 LeanSpec (specs/ \u76EE\u5F55\u4E0D\u5B58\u5728)";
var LeanspecError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "LeanspecError";
    this.code = code;
  }
};
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || !rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel);
}
function resolveProjectRoot(projectRoot) {
  if (typeof projectRoot !== "string" || projectRoot.trim() === "") return void 0;
  const trimmed = projectRoot.trim();
  if (!path.isAbsolute(trimmed)) {
    throw new LeanspecError("invalid-path", "project root must be an absolute path");
  }
  return path.resolve(trimmed);
}
function resolveSpecsDir(projectRoot) {
  const root = resolveProjectRoot(projectRoot);
  if (root === void 0) {
    throw new LeanspecError("not-spec", NO_LEANSPEC_MESSAGE);
  }
  const specs = path.join(root, "specs");
  if (!fs.existsSync(specs) || !fs.statSync(specs).isDirectory()) {
    throw new LeanspecError("not-spec", NO_LEANSPEC_MESSAGE);
  }
  return fs.realpathSync(specs);
}
function assertRelPath(relPath) {
  if (!relPath || path.isAbsolute(relPath) || relPath.split(/[/\\]/).includes("..") || relPath.split(/[/\\]/).includes(".") || relPath.split(/[/\\]/).includes("")) {
    throw new LeanspecError("invalid-path", "path escapes specs directory");
  }
}
function resolveExistingFile(projectRoot, relPath) {
  const specsDir = resolveSpecsDir(projectRoot);
  assertRelPath(relPath);
  const target = path.resolve(specsDir, relPath);
  if (!fs.existsSync(target)) {
    throw new LeanspecError("not-found", "file does not exist");
  }
  const real = fs.realpathSync(target);
  if (!isInside(specsDir, real)) {
    throw new LeanspecError("forbidden", "path escapes specs directory");
  }
  const stat = fs.statSync(real);
  if (!stat.isFile()) {
    throw new LeanspecError("not-file", "only files are allowed");
  }
  return real;
}
function listSpecs(projectRoot) {
  try {
    const specsDir = resolveSpecsDir(projectRoot);
    const specs = [];
    const files = [];
    const dirs = [];
    for (const entry of fs.readdirSync(specsDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(specsDir, entry.name);
      if (entry.isDirectory()) {
        if (/^\d{3,}-/.test(entry.name)) {
          specs.push(entry.name);
          walkSpecDir(full, entry.name, files, dirs);
        }
      }
    }
    return {
      present: true,
      specs: specs.sort((a, b) => a.localeCompare(b)),
      files: files.sort((a, b) => a.localeCompare(b)),
      dirs: dirs.sort((a, b) => a.localeCompare(b))
    };
  } catch (error) {
    if (error instanceof LeanspecError && error.code === "not-spec") {
      return { present: false, specs: [], files: [], dirs: [] };
    }
    throw error;
  }
}
function walkSpecDir(dir, prefix, files, dirs) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(rel);
      walkSpecDir(full, rel, files, dirs);
      continue;
    }
    if (entry.isFile()) files.push(rel);
  }
}
function readSpecFile(projectRoot, relPath) {
  const file = resolveExistingFile(projectRoot, relPath);
  return fs.readFileSync(file, "utf8");
}
function writeSpecFile(projectRoot, relPath, content) {
  const file = resolveExistingFile(projectRoot, relPath);
  fs.writeFileSync(file, content, "utf8");
}

// src/http.ts
function statusFor(error) {
  if (error.code === "not-spec") return 404;
  if (error.code === "invalid-root") return 400;
  if (error.code === "forbidden" || error.code === "invalid-path") return 403;
  if (error.code === "not-found" || error.code === "not-file") return 404;
  return 400;
}
function fail(error) {
  if (error instanceof LeanspecError) {
    return { status: statusFor(error), body: { error: error.message, code: error.code } };
  }
  const message = error instanceof Error ? error.message : "unexpected error";
  return { status: 500, body: { error: message } };
}
function routeTail(pathname) {
  const prefix = "/leanspec-viewer";
  if (pathname === prefix) return "";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}
function parseJsonBody(raw) {
  if (!raw) return void 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function requestRoot(input, payload) {
  const fromQuery = input.searchParams.get("root");
  if (fromQuery) return fromQuery;
  const fromBody = payload?.root;
  return typeof fromBody === "string" ? fromBody : void 0;
}
async function handleLeanspecHttp(input) {
  const method = input.method.toUpperCase();
  const tail = routeTail(input.pathname);
  try {
    if (method === "GET" && (tail === "/tree" || tail === "/changes")) {
      const listed = listSpecs(requestRoot(input));
      if (!listed.present) {
        return { status: 200, body: { present: false, specs: [], files: [], dirs: [], message: NO_LEANSPEC_MESSAGE } };
      }
      return { status: 200, body: { present: true, specs: listed.specs, files: listed.files, dirs: listed.dirs } };
    }
    if (method === "GET" && tail === "/file") {
      const relPath = input.searchParams.get("path") ?? "";
      const content = readSpecFile(requestRoot(input), relPath);
      return { status: 200, body: { content } };
    }
    if (method === "PUT" && tail === "/file") {
      const payload = parseJsonBody(input.body);
      if (payload === void 0) {
        return { status: 400, body: { error: "invalid JSON body" } };
      }
      if (typeof payload.content !== "string") {
        return { status: 400, body: { error: "content must be a string" } };
      }
      const relPath = typeof payload.path === "string" ? payload.path : "";
      writeSpecFile(requestRoot(input, payload), relPath, payload.content);
      return { status: 200, body: { ok: true } };
    }
    return { status: 404, body: { error: "not found" } };
  } catch (error) {
    return fail(error);
  }
}

// src/index.ts
var name = "leanspec-web-viewer";
var inject = ["webServer"];
function apply(ctx) {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: "prefix",
      path: "/leanspec-viewer",
      handler: (req, res) => handleLeanspecRequest(req, res)
    });
    return dispose;
  });
}
async function handleLeanspecRequest(req, res) {
  const host = req.headers.host ?? "127.0.0.1";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const result = await handleLeanspecHttp({
    method: req.method ?? "GET",
    pathname: url.pathname,
    searchParams: url.searchParams,
    body: rawBody
  });
  res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(result.body));
}
export {
  apply,
  inject,
  name
};
