/* eslint-disable @typescript-eslint/no-explicit-any */

type LogCategory = 'functions' | 'clicks' | 'fetches';

type FunctionLogEntry = {
  functionName: string;
  args: unknown[];
  time: string;
  tab: string;
  stack?: string;
};

type ClickLogEntry = {
  elementIdentifier: string;
  tab: string;
  time: string;
};

type FetchLogEntry = {
  url: string;
  method: string;
  payload: unknown;
  summary: {
    status?: number;
    ok?: boolean;
    keyFields?: string[];
    error?: string;
  };
  tab: string;
  time: string;
};

type AppLogs = {
  functions: FunctionLogEntry[];
  clicks: ClickLogEntry[];
  fetches: FetchLogEntry[];
};

declare global {
  interface Window {
    __APP_LOGS__?: AppLogs;
    __APP_LOGGER_INITIALIZED__?: boolean;
    exportLogs?: (options?: { download?: boolean }) => AppLogs;
  }
}

const MAX_ENTRIES_PER_BUCKET = 3000;

const getNow = () => new Date().toISOString();

const getActiveTab = () => {
  if (typeof window === 'undefined') return 'server';

  const hash = window.location.hash || '';
  const hashPath = hash.startsWith('#/') ? hash.slice(1) : '';
  const path = hashPath || window.location.pathname || '/';
  const normalizedPath = path.split('?')[0] || '/';
  const pageTitle = document.title?.trim();

  return pageTitle ? `${normalizedPath} (${pageTitle})` : normalizedPath;
};

const getLogs = (): AppLogs => {
  if (!window.__APP_LOGS__) {
    window.__APP_LOGS__ = {
      functions: [],
      clicks: [],
      fetches: [],
    };
  }

  return window.__APP_LOGS__;
};

const pushLog = <T extends FunctionLogEntry | ClickLogEntry | FetchLogEntry>(category: LogCategory, entry: T) => {
  const logs = getLogs();
  const bucket = logs[category] as T[];
  bucket.push(entry);

  if (bucket.length > MAX_ENTRIES_PER_BUCKET) {
    bucket.splice(0, bucket.length - MAX_ENTRIES_PER_BUCKET);
  }
};

const safeSerialize = (value: unknown) => {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue) => {
        if (typeof currentValue === 'function') return `[Function ${currentValue.name || 'anonymous'}]`;
        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
          };
        }
        if (typeof Element !== 'undefined' && currentValue instanceof Element) {
          return {
            tagName: currentValue.tagName,
            id: currentValue.id,
            className: currentValue.className,
            text: currentValue.textContent?.trim()?.slice(0, 80),
          };
        }
        return currentValue;
      })
    );
  } catch {
    return String(value);
  }
};

const summarizeResponse = async (response: Response) => {
  const summary: FetchLogEntry['summary'] = {
    status: response.status,
    ok: response.ok,
  };

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return summary;
  }

  try {
    const body = await response.clone().json();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      summary.keyFields = Object.keys(body).slice(0, 8);
    }
  } catch {
    // Ignore parse errors for logging.
  }

  return summary;
};

const getElementIdentifier = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return 'unknown-element';

  const explicitId = target.id ? `#${target.id}` : '';
  const className = typeof target.className === 'string'
    ? target.className
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((value) => `.${value}`)
        .join('')
    : '';

  const text = target.textContent?.trim()?.slice(0, 80) || '';
  const tag = target.tagName.toLowerCase();

  return explicitId || `${tag}${className}` || text || tag;
};

const logFunctionRun = (functionName: string, args: unknown[]) => {
  const entry: FunctionLogEntry = {
    functionName,
    args: safeSerialize(args) ?? [],
    time: getNow(),
    tab: getActiveTab(),
    stack: new Error().stack,
  };

  pushLog('functions', entry);
  console.log(`[FUNC_RUN] ${functionName} | args: ${JSON.stringify(entry.args)} | time: ${entry.time} | tab: ${entry.tab}`);
};

const wrapFunction = <T extends (...args: any[]) => any>(
  fn: T,
  functionName: string,
  context?: unknown
): T => {
  if (typeof fn !== 'function') return fn;

  const wrapped = function (this: unknown, ...args: unknown[]) {
    logFunctionRun(functionName, args);
    return fn.apply(context ?? this, args as any);
  };

  return wrapped as T;
};

const instrumentEventListeners = () => {
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function addEventListenerPatched(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (!listener) {
      return originalAddEventListener.call(this, type, listener, options);
    }

    let wrappedListener = listener;

    if (typeof listener === 'function') {
      wrappedListener = wrapFunction(listener, `event:${type}`);
    } else if ('handleEvent' in listener && typeof listener.handleEvent === 'function') {
      wrappedListener = {
        ...listener,
        handleEvent: wrapFunction(listener.handleEvent.bind(listener), `event:${type}:handleEvent`),
      };
    }

    return originalAddEventListener.call(this, type, wrappedListener, options);
  };
};

const instrumentTimers = () => {
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);

  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler === 'function') {
      return nativeSetTimeout(wrapFunction(handler as (...args: any[]) => any, 'setTimeout:callback'), timeout, ...args);
    }

    return nativeSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;

  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler === 'function') {
      return nativeSetInterval(wrapFunction(handler as (...args: any[]) => any, 'setInterval:callback'), timeout, ...args);
    }

    return nativeSetInterval(handler, timeout, ...args);
  }) as typeof setInterval;

  if ('requestAnimationFrame' in window) {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      return nativeRaf(wrapFunction(callback, 'requestAnimationFrame:callback'));
    }) as typeof requestAnimationFrame;
  }
};

const instrumentClicks = () => {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const clickable = target?.closest?.('button, a, [role="button"], input[type="button"], input[type="submit"], [data-clickable]') || target;
      const elementIdentifier = getElementIdentifier(clickable || target);
      const entry: ClickLogEntry = {
        elementIdentifier,
        tab: getActiveTab(),
        time: getNow(),
      };

      pushLog('clicks', entry);
      console.log(`[UI_CLICK] ${entry.elementIdentifier} | tab: ${entry.tab} | time: ${entry.time}`);
    },
    true
  );
};

const instrumentFetch = () => {
  if (typeof window.fetch !== 'function') return;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const payload = safeSerialize(init?.body);
    const startedAt = getNow();
    const tab = getActiveTab();

    try {
      const response = await nativeFetch(input, init);
      const summary = await summarizeResponse(response);
      const entry: FetchLogEntry = { url, method, payload, summary, tab, time: startedAt };
      pushLog('fetches', entry);
      console.log(`[DATA_FETCH] ${method} ${url} | tab: ${tab} | response: ${JSON.stringify(summary)}`);
      return response;
    } catch (error) {
      const summary: FetchLogEntry['summary'] = {
        error: error instanceof Error ? error.message : String(error),
      };
      const entry: FetchLogEntry = { url, method, payload, summary, tab, time: startedAt };
      pushLog('fetches', entry);
      console.log(`[DATA_FETCH] ${method} ${url} | tab: ${tab} | response: ${JSON.stringify(summary)}`);
      throw error;
    }
  }) as typeof fetch;
};

const instrumentXmlHttpRequest = () => {
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function openPatched(method: string, url: string | URL, ...rest: unknown[]) {
    (this as any).__logMethod = method;
    (this as any).__logUrl = typeof url === 'string' ? url : url.toString();
    (this as any).__logTab = getActiveTab();
    (this as any).__logTime = getNow();

    return nativeOpen.call(this, method, url, ...(rest as [boolean | undefined, string | null | undefined, string | null | undefined]));
  };

  XMLHttpRequest.prototype.send = function sendPatched(body?: Document | XMLHttpRequestBodyInit | null) {
    (this as any).__logPayload = safeSerialize(body);

    this.addEventListener('loadend', () => {
      const entry: FetchLogEntry = {
        url: (this as any).__logUrl || 'unknown-url',
        method: (this as any).__logMethod || 'GET',
        payload: (this as any).__logPayload,
        summary: {
          status: this.status,
          ok: this.status >= 200 && this.status < 300,
        },
        tab: (this as any).__logTab || getActiveTab(),
        time: (this as any).__logTime || getNow(),
      };

      pushLog('fetches', entry);
      console.log(`[DATA_FETCH] ${entry.method} ${entry.url} | tab: ${entry.tab} | response: ${JSON.stringify(entry.summary)}`);
    });

    return nativeSend.call(this, body ?? null);
  };
};

const instrumentHistory = () => {
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);

  history.pushState = ((...args: Parameters<History['pushState']>) => {
    const result = pushState(...args);
    logFunctionRun('history.pushState', args);
    return result;
  }) as History['pushState'];

  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    const result = replaceState(...args);
    logFunctionRun('history.replaceState', args);
    return result;
  }) as History['replaceState'];

  window.addEventListener('hashchange', () => logFunctionRun('navigation:hashchange', [window.location.hash]));
  window.addEventListener('popstate', () => logFunctionRun('navigation:popstate', [window.location.href]));
};

const installExportUtility = () => {
  window.exportLogs = (options?: { download?: boolean }) => {
    const snapshot = JSON.parse(JSON.stringify(getLogs())) as AppLogs;

    if (options?.download) {
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `app-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    return snapshot;
  };
};

export const initializeRuntimeInstrumentation = () => {
  if (typeof window === 'undefined' || window.__APP_LOGGER_INITIALIZED__) {
    return;
  }

  window.__APP_LOGGER_INITIALIZED__ = true;
  getLogs();

  instrumentEventListeners();
  instrumentTimers();
  instrumentClicks();
  instrumentFetch();
  instrumentXmlHttpRequest();
  instrumentHistory();
  installExportUtility();

  logFunctionRun('runtimeInstrumentation:init', []);
};

export const instrumentFunction = <T extends (...args: any[]) => any>(fn: T, functionName: string): T => {
  return wrapFunction(fn, functionName);
};
