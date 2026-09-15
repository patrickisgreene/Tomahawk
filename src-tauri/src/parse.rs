use chrono::DateTime;
use regex::Regex;
use std::sync::OnceLock;

static LINE_RE: OnceLock<Regex> = OnceLock::new();

fn line_re() -> &'static Regex {
    LINE_RE.get_or_init(|| {
        // Apache/httpd Combined Log Format, with an optional trailing
        // numeric token to tolerate a custom LogFormat that appends
        // response time (e.g. "... %D" in microseconds) — standard
        // Combined format doesn't include timing at all, so it's optional.
        Regex::new(
            r#"^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)"(?: (\d+(?:\.\d+)?))?\s*$"#,
        )
        .expect("static regex is valid")
    })
}

pub struct ParsedAccessLine {
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
    let ip = caps[1].to_string();
    let ts = DateTime::parse_from_str(&caps[2], "%d/%b/%Y:%H:%M:%S %z").ok()?;
    let mut parts = caps[3].split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();
    let status: u16 = caps[4].parse().ok()?;
    let bytes: u64 = if &caps[5] == "-" {
        0
    } else {
        caps[5].parse().unwrap_or(0)
    };
    let ms = caps.get(8).and_then(|m| m.as_str().parse::<f64>().ok());
    let referer = caps[6].to_string();
    let user_agent = caps[7].to_string();

    Some(ParsedAccessLine {
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
}
