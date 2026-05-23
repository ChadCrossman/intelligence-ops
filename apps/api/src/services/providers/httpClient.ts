const USER_AGENT = "PublishWeaver-IntelligenceOps/0.1";

export async function fetchText(url: string, headers?: HeadersInit): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...headers }
  });

  if (!response.ok) {
    throw new Error(`${url} failed with status ${response.status}`);
  }

  return response.text();
}
