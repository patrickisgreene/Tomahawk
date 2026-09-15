use chrono::DateTime;
use regex::Regex;
use std::sync::OnceLock;

static LINE_RE: OnceLock<Regex> = OnceLock::new();

fn line_re() -> &'static Regex {
    LINE_RE.get_or_init(|| {
        // Combined format, optionally with a virtual host after bytes and
        // a quoted forwarded-for field after the user agent. Optional trailing
        // numeric token to tolerate a custom LogFormat that appends
        // response time (e.g. "... %D" in microseconds) — standard
        // Combined format doesn't include timing at all, so it's optional.
        Regex::new(
            r#"^(?P<ip>\S+) (?P<ident>\S+) (?P<auth_user>\S+) \[(?P<timestamp>[^\]]+)\] "(?P<request>(?:[^"\x5c]|\x5c.)*)" (?P<status>\d{3}) (?P<bytes>\S+)(?: (?P<hostname>[^\s"]+))? "(?P<referer>(?:[^"\x5c]|\x5c.)*)" "(?P<user_agent>(?:[^"\x5c]|\x5c.)*)"(?: "(?P<forwarded_for>(?:[^"\x5c]|\x5c.)*)")?(?: (?P<duration>\d+(?:\.\d+)?))?\s*$"#,
        )
        .expect("static regex is valid")
    })
}

pub struct ParsedAccessLine {
    pub hostname: String,
    pub forwarded_for: String,
    pub ident: String,
    pub auth_user: String,
    pub timestamp: String,
    pub request: String,
    pub protocol: String,
    pub ts: i64,
    pub time: String,
    pub ip: String,
    pub method: String,
    pub status: u16,
    pub path: String,
    pub bytes: u64,
    pub ms: Option<f64>,
    pub referer: String,
    pub user_agent: String,
}

/// Parses one Apache Combined Log Format line. Returns `None` for lines
/// that don't match (blank lines, truncated final line, unexpected format)
/// rather than failing the whole ingest — a handful of unparseable lines
/// shouldn't block the rest of a multi-million-line archive.
pub fn parse_access_line(line: &str) -> Option<ParsedAccessLine> {
    let caps = line_re().captures(line.trim_end())?;
    let ip = caps["ip"].to_string();
    let ts = DateTime::parse_from_str(&caps["timestamp"], "%d/%b/%Y:%H:%M:%S %z").ok()?;
    let mut parts = caps["request"].split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();
    let status: u16 = caps["status"].parse().ok()?;
    let bytes: u64 = if &caps["bytes"] == "-" {
        0
    } else {
        caps["bytes"].parse().unwrap_or(0)
    };
    let ms = caps.name("duration").and_then(|m| m.as_str().parse::<f64>().ok());
    let referer = caps["referer"].to_string();
    let user_agent = caps["user_agent"].to_string();

    let protocol = parts.next().unwrap_or("").to_string();
    Some(ParsedAccessLine {
        protocol,
        hostname: caps.name("hostname").map(|m| m.as_str().to_string()).unwrap_or_default(),
        forwarded_for: caps.name("forwarded_for").map(|m| m.as_str().to_string()).unwrap_or_default(),
        ident: caps.name("ident").map(|m| m.as_str().to_string()).unwrap_or_default(),
        auth_user: caps.name("auth_user").map(|m| m.as_str().to_string()).unwrap_or_default(),
        timestamp: caps.name("timestamp").map(|m| m.as_str().to_string()).unwrap_or_default(),
        request: caps.name("request").map(|m| m.as_str().to_string()).unwrap_or_default(),

        ts: ts.timestamp_millis(),
        time: ts.format("%H:%M:%S").to_string(),
        ip,
        method,
        status,
        path,
        bytes,
        ms,
        referer,
        user_agent,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_combined_log_line() {
        let line = r#"192.0.2.14 - - [14/Sep/2026:18:00:01 -0500] "GET / HTTP/1.1" 200 8421 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0""#;
        let parsed = parse_access_line(line).expect("should parse");
        assert_eq!(parsed.ip, "192.0.2.14");
        assert_eq!(parsed.method, "GET");
        assert_eq!(parsed.path, "/");
        assert_eq!(parsed.status, 200);
        assert_eq!(parsed.bytes, 8421);
        assert_eq!(parsed.ms, None); // standard Combined format has no timing field
        assert_eq!(parsed.time, "18:00:01");
        assert_eq!(parsed.referer, "-");
        assert_eq!(parsed.user_agent, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0");
    }

    #[test]
    fn dash_bytes_is_zero() {
        let line = r#"192.0.2.200 - - [14/Sep/2026:18:02:41 -0500] "GET /health HTTP/1.1" 200 16 "-" "kube-probe/1.34""#;
        let parsed = parse_access_line(line).expect("should parse");
        assert_eq!(parsed.bytes, 16);
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_access_line("not a log line").is_none());
        assert!(parse_access_line("").is_none());
    }

    #[test]
    fn accepts_escaped_quotes_inside_fields() {
        let line = r#"192.0.2.1 - - [15/Sep/2026:00:00:08 -0400] "GET / HTTP/1.1" 200 25 example.com "-" "\"Mozilla/5.0\"" "-""#;
        let parsed = parse_access_line(line).expect("escaped user agent");
        assert_eq!(parsed.user_agent, r#"\"Mozilla/5.0\""#);
        assert_eq!(parsed.referer, "-");
    }

    #[test]
    fn parses_virtual_host_and_forwarded_for() {
        let line = r#"2607:f1c0:500:: - - [15/Sep/2026:00:00:13 -0400] "POST /wp-cron.php HTTP/1.1" 200 - example.com "-" "WordPress/7.1" "-""#;
        let parsed = parse_access_line(line).expect("virtual host format");
        assert_eq!(parsed.ip, "2607:f1c0:500::");
        assert_eq!(parsed.bytes, 0);
        assert_eq!(parsed.referer, "-");
        assert_eq!(parsed.user_agent, "WordPress/7.1");
        assert_eq!(parsed.path, "/wp-cron.php");
        assert_eq!(parsed.ms, None);
        assert_eq!(parse_access_line(&format!("{line} 123")).unwrap().ms, Some(123.0));
    }
}
