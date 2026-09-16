// Suspicious-request classification.
//
// These are URL-pattern heuristics applied to the parsed request (path +
// query, and optionally the user agent). A rule describes what a request
// LOOKS like — a probe for a config file, a traversal attempt, a SQLi or
// XSS probe, a known webshell path — never what happened server-side. An
// access log carries no response body or application context, so the
// "Classified" tags in the inspector flag patterns worth a human look;
// they never claim an exploit succeeded.

export const BUILT_IN_RULES = [
  // ---- high severity: exploit-shaped strings ----

  // Dot-dot path traversal / local file inclusion.
  { label: "path traversal", severity: "high", scope: "url", test: (s) =>
    /(?:\.\.\/|\.\.%2f|\.\.%5c|\.\.\\)/i.test(s) ||
    /%2e%2e/i.test(s) ||
    /(?:^|\/)(?:etc\/passwd|etc\/shadow|etc\/hosts|proc\/self|\.\.\/\.\.)/i.test(s) ||
    /(?:^|\/)(?:win\.ini|boot\.ini|autoexec\.bat)(?:\?|$)/i.test(s) ||
    /c:\\windows/i.test(s)
  },

  // SQL injection breadcrumbs — the presence of query operators or probing
  // functions is the signal, not any claim that they executed.
  { label: "SQLi probe", severity: "high", scope: "url", test: (s) =>
    /(?:union|union all)\s+select/i.test(s) ||
    /information_schema/i.test(s) ||
    /\bsleep\s*\(/i.test(s) ||
    /\b(?:pg_sleep|benchmark)\s*\(/i.test(s) ||
    /\bwaitfor\s+delay\b/i.test(s) ||
    /\b@@(?:version|servername)\b/i.test(s) ||
    /\b['"]\s*(?:or|and)\s+\d+\s*=\s*\d+/i.test(s) ||
    /(?:or|and)\s*\+?['"]?\d+['"]?\s*=\s*['"]?\d+/i.test(s) ||
    /(?:or|and)\s+1\s*=\s*1\b/i.test(s) ||
    /\b(?:1|0)\s*=\s*(?:1|0)\b/i.test(s) ||
    /(?:--|#|\/\*)\s*(?:select|union|insert|drop|update)\b/i.test(s) ||
    /\bconcat\s*\(/i.test(s) ||
    /%27/i.test(s)
  },

  // Reflected XSS payloads.
  { label: "XSS probe", severity: "high", scope: "url", test: (s) =>
    /<script/i.test(s) ||
    /%3[cC]script/i.test(s) ||
    /javascript:/i.test(s) ||
    /\bonerror\s*=/i.test(s) ||
    /\bonload\s*=/i.test(s) ||
    /\balert\s*\(/i.test(s) ||
    /\bprompt\s*\(/i.test(s) ||
    /\bconfirm\s*\(/i.test(s) ||
    /document\.cookie/i.test(s)
  },

  // Command injection / arbitrary code execution primitives.
  { label: "command injection", severity: "high", scope: "url", test: (s) =>
    /\b(?:cmd|command)\.exe\b/i.test(s) ||
    /\bpowershell\b/i.test(s) ||
    /\bwget\s+-?/i.test(s) ||
    /\bcurl\s+-?/i.test(s) ||
    /\bnc\s+-/i.test(s) ||
    /\bnetcat\b/i.test(s) ||
    /\bbash\s+-(?:c|i)\b/i.test(s) ||
    /\/bin\/(?:sh|bash)\b/i.test(s) ||
    /\bwhoami\b/i.test(s) ||
    /jndi[:\/]/i.test(s) ||
    /\$\{jndi:/i.test(s) ||
    /\beval\s*\(/i.test(s) ||
    /\bfromCharCode\b/i.test(s)
  },

  // Well-known webshell / backdoor filenames.
  { label: "webshell", severity: "high", scope: "url", test: (s) =>
    /(?:^|\/)(?:c99|r57|b374k|wso|shell|cmd|webadmin|phpspy|backdoor)\.php/i.test(s) ||
    /(?:^|\/)wp-content\/uploads\/.*\.php/i.test(s) ||
    /\bshell\.php\b|\bsh\.php\b|\bcmd\.php\b/i.test(s)
  },

  // ---- lower severity: probing / scanning behavior ----

  // Config, backup, and credential-file probing.
  { label: "config probe", severity: "warn", scope: "url", test: (s) =>
    /(?:^|\/)\.env(?:\?|$)/i.test(s) ||
    /(?:^|\/)\.git\/(?:config|HEAD)|\.git%2f/i.test(s) ||
    /(?:^|\/)(?:wp-config|config)\.php(?:\.(?:old|bak|save|orig))?(?:\?|$)/i.test(s) ||
    /(?:^|\/)\.htaccess(?:\?|$)/i.test(s) ||
    /\.(?:bak|old|orig|save|swp|swo)(?:\?|$)/i.test(s) ||
    /(?:backup|dump|db)\.(?:sql|zip|tar|tar\.gz|gz)(?:\?|$)/i.test(s) ||
    /\.aws\/(?:credentials|config)/i.test(s) ||
    /%00/i.test(s)
  },

  // Admin / login / management surface probing.
  { label: "login probe", severity: "warn", scope: "url", test: (s) =>
    /(?:^|\/)wp-login\.php(?:\?|$)/i.test(s) ||
    /(?:^|\/)wp-admin(?:\/|\?|$)/i.test(s) ||
    /(?:^|\/)wp-json\/wp\/v2\/users/i.test(s) ||
    /\bxmlrpc\.php\b/i.test(s) ||
    /(?:^|\/)(?:phpmyadmin|pma|myadmin|adminer|admin|administrator)(?:\/|\?|$)/i.test(s) ||
    /(?:^|\/)login\.php(?:\?|$)/i.test(s) ||
    /(?:^|\/)user_login(?:\?|$)/i.test(s) ||
    /(?:^|\/)server-status(?:\/?|\?|$)/i.test(s) ||
    /(?:^|\/)manager\/html(?:\/?|\?|$)/i.test(s) ||
    /\?author=\d+/i.test(s)
  },

  // Known scanner/attack tooling announcing itself in the user agent.
  { label: "scanner", severity: "warn", scope: "ua", test: (s) =>
    /\b(?:sqlmap|nmap|nikto|nessus|masscan|zgrab|acunetix|openvas|wpscan|dirbuster|gobuster|nuclei|ffuf|wfuzz|hydra|metasploit|patator)\b/i.test(s) ||
    /\bfuzz(?:ing|er)?\b/i.test(s)
  },
];

const BOT_UA = [
  /googlebot/i, /bingbot/i, /duckduckbot/i, /baiduspider/i, /yandex/i, /slurp/i, /yahoo/i,
  /applebot/i, /facebookexternalhit/i, /facebot/i, /sogou/i, /exabot/i, /ia_archiver/i,
  /ahrefsbot/i, /semrushbot/i, /mj12bot/i, /dotbot/i, /petalbot/i, /bytespider/i,
  /amazonbot/i, /gptbot/i, /ccbot/i, /claudebot/i, /perplexitybot/i, /twitterbot/i,
  /telegrambot/i, /whatsapp/i, /uptimerobot/i,
];

const WEIGHT = { high: 2, warn: 1 };

export function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function enabledBuiltInRule(rule, settings) {
  if (settings?.builtInEnabled === false) return false;
  const disabled = settings?.disabledBuiltInRuleIds || [];
  return !disabled.includes(slug(rule.label));
}

function targetForRule(row, scope, rawPath, decodedPath) {
  if (scope === "ua") return row?.userAgent || "";
  if (scope === "ip") return row?.ip || "";
  if (scope === "method") return row?.method || "";
  if (scope === "status") return String(row?.status ?? "");
  if (scope === "raw") return row?.raw || "";
  return `${rawPath} ${decodedPath}`;
}

function customRuleMatches(rule, target) {
  if (!rule?.enabled || !rule.pattern) return false;
  try {
    return new RegExp(rule.pattern, "i").test(target);
  } catch {
    return false;
  }
}

/**
 * @param {{ path?: string, userAgent?: string }} row  parsed access-log row
 * @returns {{ id: string, label: string, severity: "high" | "warn" }[]}
 * Tagged classifications for the request, most severe first, blank when the
 * request looks ordinary. Paths are matched against both the raw value and a
 * best-effort URL-decoded copy so `%2e%2e/`-style tricks don't hide a rule.
 */
export function classifyRequest(row, settings = null) {
  const rawPath = row?.path || "";
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    // Leave the raw path as-is — malformed encodings still match the raw rules.
  }
  const ua = row?.userAgent || "";

  const seen = new Set();
  const tags = [];
  for (const rule of BUILT_IN_RULES) {
    if (!enabledBuiltInRule(rule, settings)) continue;
    if (seen.has(rule.label)) continue;
    const target = rule.scope === "ua" ? ua : `${rawPath} ${decodedPath}`;
    if (rule.test(target)) {
      seen.add(rule.label);
      tags.push({ id: slug(rule.label), label: rule.label, severity: rule.severity });
    }
  }
  for (const rule of settings?.customRules || []) {
    if (seen.has(rule.label)) continue;
    const label = (rule.label || "").trim();
    if (!label) continue;
    const target = targetForRule(row, rule.scope || "url", rawPath, decodedPath);
    if (customRuleMatches(rule, target)) {
      seen.add(label);
      tags.push({ id: rule.id || slug(label), label, severity: rule.severity === "high" ? "high" : "warn" });
    }
  }
  tags.sort((a, b) => (WEIGHT[b.severity] || 0) - (WEIGHT[a.severity] || 0));
  return tags.slice(0, 5);
}

/**
 * True when the user agent belongs to a known crawler/bot or to the
 * scanner tooling covered by the rules above. Note: this is the UA
 * announcing itself — stealth bots that impersonate browsers can't be
 * caught by a header that never existed in the log line.
 */
export function isLikelyBot(userAgent, settings = null) {
  if (settings?.botDetectionEnabled === false) return false;
  if (!userAgent) return false;
  return BOT_UA.some((re) => re.test(userAgent)) || BUILT_IN_RULES.some((r) => enabledBuiltInRule(r, settings) && r.scope === "ua" && r.test(userAgent));
}
