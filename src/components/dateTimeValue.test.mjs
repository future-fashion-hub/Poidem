import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const module = { exports: {} };
const source = ts.transpileModule(readFileSync(new URL("./dateTimeValue.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function("exports", source)(module.exports);
const { pickerTime } = module.exports;

test("valid picker times preserve every minute, including midnight", () => {
  for (const time of ["00:00", "09:07", "12:30", "23:59"]) assert.equal(pickerTime(`2026-10-14T${time}`), time);
  assert.equal(pickerTime("2026-10-14T09:07:00Z"), "09:07");
});

test("cleared and invalid times cannot crash date formatting", () => {
  for (const value of ["", "2026-10-14", "2026-10-14T", "2026-10-14T24:00", "2026-10-14T12:60", "2026-10-14T09:0"]) {
    assert.equal(pickerTime(value), "12:00");
    assert.doesNotThrow(() => new Intl.DateTimeFormat("ru-RU").format(new Date(`2026-10-14T${pickerTime(value)}`)));
  }
});
