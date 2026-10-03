/**
 * The Design workspace's wire: JSON-RPC `tools/call` posts to the plugin's own declared MCP server, and what comes back.
 *
 * Why a plain POST: Claude Code keeps the server's app-only tools (status, image, pick, run, handoff) out of its tool
 * registry, so the engine's MCP route refuses them; a plain POST reaches them (design §3.2, planner probes 1 and 2). The
 * server is stateless JSON, so no `initialize` is needed.
 *
 * Pure: the one fetch lives in register.mjs, its address (https://design.12ui.com/mcp, the plugin's inline MCP URL)
 * and options written at the call. This module builds the request body and reads the answer.
 */

/** The server's tool names, as the screen's contract spells them. */
export const TOOLS = Object.freeze({
  show: 'design.slate.show',
  data: 'design.slate.data',
  status: 'design.slate.status',
  image: 'design.slate.image',
  pick: 'design.slate.pick',
  run: 'design.slate.run',
  handoff: 'design.slate.handoff',
  reference: 'design.slate.reference',
  inspire: 'design.slate.inspire',
});

let nextId = 1;

/** The JSON body of one `tools/call`: the tool's name and arguments, under a fresh JSON-RPC id. */
export function rpcBody(name, args) {
  const id = nextId;
  nextId += 1;
  return JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
}

/** An answer the pane shows as its error line: the server's or the transport's own words, verbatim. */
export function workspaceError(message, { code = null, status = null, retryable = false } = {}) {
  const error = new Error(message);
  error.name = 'WorkspaceError';
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  return error;
}

/** Whether an error is one `workspaceError` made: a server answer, as opposed to no answer at all. */
export function isWorkspaceError(error) {
  return Boolean(error) && error.name === 'WorkspaceError';
}

function firstText(content) {
  if (!Array.isArray(content)) return '';
  const block = content.find((item) => item && item.type === 'text' && typeof item.text === 'string');
  return block ? block.text : '';
}

/**
 * The tool result of one `$.http.fetch` answer: `{ structured, content }`, or a thrown workspaceError carrying the
 * HTTP status, the JSON-RPC error, or the tool's own `isError` text ("code: message") verbatim.
 */
export function readRpc(response) {
  const status = response && typeof response.status === 'number' ? response.status : null;
  const text = response && typeof response.text === 'string' ? response.text : '';
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response || !response.ok) {
    const serverWords = body && typeof body.error === 'string' ? body.error
      : body && body.error && typeof body.error.message === 'string' ? body.error.message
        : text.trim().slice(0, 300);
    throw workspaceError(`design.12ui.com answered ${status ?? 'nothing'}${serverWords ? `: ${serverWords}` : ''}`, {
      status,
      code: status === 429 ? 'rate_limited' : null,
      retryable: status === 429 || (status !== null && status >= 500),
    });
  }
  if (!body || typeof body !== 'object') throw workspaceError('design.12ui.com sent an answer that is not JSON', { status });
  if (body.error) {
    const message = typeof body.error.message === 'string' ? body.error.message : 'the request was refused';
    throw workspaceError(message, { status, code: body.error.code ?? null });
  }
  const result = body.result;
  if (!result || typeof result !== 'object') throw workspaceError('design.12ui.com sent an answer with no result', { status });
  const structured = result.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent : null;
  if (result.isError) {
    const words = firstText(result.content) || (structured && typeof structured.message === 'string' ? structured.message : 'the request failed');
    throw workspaceError(words, {
      status,
      code: structured && typeof structured.code === 'string' ? structured.code : null,
      retryable: Boolean(structured && structured.retryable),
    });
  }
  return { structured, content: Array.isArray(result.content) ? result.content : [] };
}

/** The base64 data of the first image block of a tool result, with its type; null when there is none. */
export function imageBlock(content) {
  const block = Array.isArray(content) ? content.find((item) => item && item.type === 'image' && typeof item.data === 'string') : null;
  return block ? { data: block.data, mimeType: typeof block.mimeType === 'string' ? block.mimeType : '' } : null;
}

/**
 * Whether a later read can mend a failed call: a workspaceError the server marked retryable (a 429, a 5xx, a tool result
 * with `retryable: true`), or no answer at all (`$.http.fetch` refused or failed). A refusal the server answered, such as
 * `unknown_workspace`, is final.
 */
export function mendsOnRetry(error) {
  return isWorkspaceError(error) ? error.retryable : true;
}

/** The line the pane shows when `$.http.fetch` itself was refused or failed (no answer from the server at all). */
export function unreachableLine(error) {
  const reason = error && typeof error.message === 'string' && error.message ? error.message : String(error);
  return `The Design workspace can't reach design.12ui.com: ${reason}`;
}

/** The pane's error line for any failure of a call: a server answer verbatim, or the unreachable line. */
export function errorLine(error) {
  return isWorkspaceError(error) ? error.message : unreachableLine(error);
}
