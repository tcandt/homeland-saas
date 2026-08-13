export function parseServerSentEvents(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const boundary = normalized.lastIndexOf('\n\n');
  if (boundary < 0) return { events: [] as string[], remainder: normalized };

  const complete = normalized.slice(0, boundary);
  const remainder = normalized.slice(boundary + 2);
  const events = complete
    .split('\n\n')
    .map((block) => block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n'))
    .filter(Boolean);

  return { events, remainder };
}

export async function consumeServerSentEvents(
  response: Response,
  onData: (data: string) => void,
) {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const parsed = parseServerSentEvents(buffer);
    buffer = parsed.remainder;
    parsed.events.forEach(onData);
    if (done) break;
  }
}
