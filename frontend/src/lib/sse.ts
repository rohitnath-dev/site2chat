/** Incremental parser for a server-sent-events stream. Feed it decoded text in any-sized pieces. */
export interface SseEvent {
  event: string;
  data: string;
}

const MAX_BUFFER = 1_000_000; // an event this large without a boundary means the stream is not ours

export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = "";

  const dispatch = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue; // blank line or comment
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      let value = i === -1 ? "" : line.slice(i + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length > 0) onEvent({ event, data: data.join("\n") });
  };

  return {
    /** Add text. Complete events (ended by a blank line) are dispatched; a partial one stays buffered. */
    push(chunk: string) {
      buffer = (buffer + chunk).replace(/\r\n/g, "\n").replace(/\r(?!$)/g, "\n");
      let i: number;
      while ((i = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        dispatch(block);
      }
      if (buffer.length > MAX_BUFFER) throw new Error("Stream event too large");
    },
    /** Call once when the stream ends; a trailing event without its blank line is still delivered. */
    end() {
      const rest = buffer.trim() ? buffer : "";
      buffer = "";
      if (rest) dispatch(rest);
    },
  };
}
