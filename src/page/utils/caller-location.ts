// Global stack trace filter to remove pw-core internal frames from all error stacks.
// This ensures that Playwright's auto-generated steps and expectations are attributed
// directly to the user's project files instead of showing internal pw-core library paths.
const originalPrepare = Error.prepareStackTrace;
Error.prepareStackTrace = (err, stack) => {
  const filteredStack = stack.filter(frame => {
    const file = frame.getFileName();
    if (!file) return true;
    const normalized = file.replace(/\\/g, '/');
    if (
      normalized.includes('pw-core/src') ||
      normalized.includes('pw-core/dist') ||
      normalized.includes('node_modules/pw-core')
    ) {
      return false;
    }
    return true;
  });

  if (originalPrepare) {
    try {
      return originalPrepare(err, filteredStack);
    } catch {
      // Fallback if originalPrepare fails on filtered stack
    }
  }

  const errString = err.toString ? err.toString() : String(err);
  return errString + '\n' + filteredStack.map(frame => {
    try {
      return '    at ' + frame.toString();
    } catch {
      return '    at <unknown>';
    }
  }).join('\n');
};

export function getCallerLocation(): { file: string; line: number; column: number } | undefined {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    const err = {} as { stack?: NodeJS.CallSite[] };
    Error.prepareStackTrace = (_err, stack) => stack;
    Error.captureStackTrace(err);
    const stack = err.stack;
    if (!stack) return undefined;

    for (let i = 1; i < stack.length; i++) {
      const frame = stack[i];
      const file = frame.getFileName();
      if (!file) continue;

      const normalizedFile = file.replace(/\\/g, '/');

      // Skip internal node_modules, node built-ins, and pw-core source/dist files
      if (
        normalizedFile.includes('node_modules') ||
        normalizedFile.includes('pw-core/src') ||
        normalizedFile.includes('pw-core/dist') ||
        normalizedFile.includes('playwright/lib') ||
        normalizedFile.includes('@playwright') ||
        normalizedFile.startsWith('node:') ||
        !normalizedFile.includes('/')
      ) {
        continue;
      }

      const line = frame.getLineNumber();
      const column = frame.getColumnNumber();
      if (!line) continue;

      return { file, line, column: column ?? 1 };
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}


