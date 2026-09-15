// Preserve Windows verbatim paths: their separators must remain backslashes.
export function joinLocalPath(path, name) {
  const separator = path.includes("\\") || /^[A-Za-z]:/.test(path) ? "\\" : "/";
  return path.endsWith(separator) ? path + name : path + separator + name;
}

export function localPathCrumbs(path) {
  if (!path) return [];
  const windows = path.includes("\\") || /^[A-Za-z]:/.test(path);
  const separator = windows ? "\\" : "/";
  const root = windows
    ? path.match(/^(?:\\\\\?\\UNC\\[^\\]+\\[^\\]+\\?|\\\\\?\\[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+\\?|[A-Za-z]:[\\/])/i)?.[0]
    : path.startsWith("/") ? "/" : "";
  let current = root || "";
  const crumbs = windows && root ? [{ label: root, path: root.endsWith(separator) ? root : root + separator }] : [];
  for (const label of path.slice(current.length).split(windows ? /[\\/]/ : /\//).filter(Boolean)) {
    current = current ? joinLocalPath(current, label) : label;
    crumbs.push({ label, path: current });
  }
  return crumbs;
}
