import { requestChunks, type RequestOptions } from './request';

export async function* stream(options: RequestOptions) {
  let tail = '';
  let skipLF = false;
  let data: string[] = [];
  for await (const chunk of requestChunks(options, 'text/event-stream')) {
    if (!chunk) continue;
    const text: string =
      skipLF && chunk.startsWith('\n') ? chunk.slice(1) : chunk;
    skipLF = text.endsWith('\r');
    const lines = text.split(/\r\n|[\r\n]/);
    lines[0] = tail + lines[0];
    tail = lines.pop()!;
    for (const line of lines) {
      if (line === '') {
        const event = data.join('\n');
        data = [];
        if (event) yield event;
      } else if (line === 'data' || line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
    }
  }
}
