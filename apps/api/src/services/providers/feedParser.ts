export function hostnameFromUrl(value: string, fallback = "unknown source"): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

export function firstText(value: string, pattern: RegExp): string | undefined {
  const match = value.match(pattern);
  return match?.[1] ? decodeXml(match[1].trim()) : undefined;
}

export function decodeXml(value: string): string {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
