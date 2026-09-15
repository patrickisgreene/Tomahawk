import test from "node:test";
import assert from "node:assert/strict";
import { joinLocalPath, localPathCrumbs } from "./localPath.js";

for (const [parent, child, root] of [
  ["C:\\Users\\patri", "C:\\Users\\patri\\Downloads", "C:\\"],
  ["\\\\?\\C:\\Users\\patri", "\\\\?\\C:\\Users\\patri\\Downloads", "\\\\?\\C:\\"],
  ["\\\\server\\share\\patri", "\\\\server\\share\\patri\\Downloads", "\\\\server\\share\\"],
  ["\\\\?\\UNC\\server\\share\\patri", "\\\\?\\UNC\\server\\share\\patri\\Downloads", "\\\\?\\UNC\\server\\share\\"],
  ["/home/patri", "/home/patri/Downloads", "/home"],
]) {
  test(`navigate into Downloads and back from ${parent}`, () => {
    assert.equal(joinLocalPath(parent, "Downloads"), child);
    const crumbs = localPathCrumbs(child);
    assert.equal(crumbs.at(-1).path, child);
    assert.equal(crumbs.at(-1).label, "Downloads");
    assert.equal(crumbs.at(-2).path, parent);
    assert.equal(crumbs[0].path, root);
    assert.equal(joinLocalPath(child, "access.log"), child + (child.includes("\\") ? "\\" : "/") + "access.log");
  });
}

test("join at filesystem roots without doubling separators", () => {
  assert.equal(joinLocalPath("C:\\", "Downloads"), "C:\\Downloads");
  assert.equal(joinLocalPath("/", "var"), "/var");
});
