/**
 * Workspace handles (`runDir`, "w_" and 22 base62 characters): reading them from the results of the plugin's own create
 * and show tools. Pure: no `$`.
 */

/** The plugin's two model-facing tools whose results name a workspace (exact names as Claude Code lists them). */
export const CREATE_TOOL = 'mcp__plugin_12ui-design_12ui-workspace__design_slate_create';
export const SHOW_TOOL = 'mcp__plugin_12ui-design_12ui-workspace__design_slate_show';

const HANDLE = /^w_[0-9A-Za-z]{22}$/;
const HANDLE_IN_TEXT = /\bw_[0-9A-Za-z]{22}\b/;

/** Whether the text is exactly one workspace handle. */
export function isHandle(text) {
  return typeof text === 'string' && HANDLE.test(text);
}

function handleInText(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && isHandle(parsed.runDir)) return parsed.runDir;
  } catch {
    // Not JSON: the text the model reads may be plain words; the pattern below reads those.
  }
  const match = HANDLE_IN_TEXT.exec(text);
  return match ? match[0] : null;
}

function stringify(value) {
  try {
    return value === undefined ? '' : JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * The workspace a create or show call names: the show input's `runDir`, else the first handle in the result as the
 * model reads it (`text`), else in the result record. Null when the call names none (an error result, a deny).
 */
export function handleFromCall(input, result) {
  if (input && input.tool === SHOW_TOOL && isHandle(input.runDir)) return input.runDir;
  if (!result || result.deny || result.isError) return null;
  return handleInText(result.text) ?? handleInText(stringify(result.result));
}
