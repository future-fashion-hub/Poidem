import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const types = {};
new Function("exports", compile("../api/types.ts"))(types);
const admin = { id: 1, role: "admin", status: "active", firstName: "Admin", lastName: null };
function harness(backendMode, getCurrentUser = async () => admin) {
  const saved = new Map();
  const exports = {};
  let logins = 0;
  const api = { getCurrentUser, loginAdmin: async () => { logins++; return { user: admin }; } };
  const sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  new Function("require", "exports", "sessionStorage", compile("./adminSession.ts"))(
    name => name.endsWith("types") ? types : { api, backendMode }, exports, sessionStorage,
  );
  return { ...exports, saved, logins: () => logins };
}
test("backend session restoration uses current user, never a blank password login", async () => {
  let reads = 0;
  const api = harness(true, async () => { reads++; return admin; });
  const [first, second] = await Promise.all([api.restoreAdminSession(), api.restoreAdminSession()]);
  assert.equal(first.role, "admin"); assert.equal(second.id, 1);
  assert.equal(reads, 1); assert.equal(api.logins(), 0);
});
test("mock access without a session rejects without starting a conflicting login", async () => {
  const api = harness(false);
  await assert.rejects(api.restoreAdminSession(), error => error.status === 401);
  assert.equal(api.logins(), 0);
  await api.createAdminSession("example", "example");
  assert.equal((await api.restoreAdminSession()).role, "admin");
});
test("ordinary users cannot restore an admin identity", async () => {
  const api = harness(true, async () => ({ ...admin, role: "user" }));
  await assert.rejects(api.restoreAdminSession(), error => error.status === 403);
  assert.equal(api.readAdminSession(), null);
});
