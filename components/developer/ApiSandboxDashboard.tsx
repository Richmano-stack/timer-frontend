'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  getMethodBadgeClass,
  getStatusTone,
  SANDBOX_ENDPOINTS,
  SandboxEndpoint,
} from '@/lib/developer/sandbox-endpoints';

interface RequestResult {
  status: number;
  statusText: string;
  durationMs: number;
  body: string;
  ok: boolean;
}

function highlightJson(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-slate-300';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'text-violet-400' : 'text-emerald-300';
      } else if (/true|false/.test(match)) {
        cls = 'text-amber-300';
      } else if (/null/.test(match)) {
        cls = 'text-slate-500';
      } else {
        cls = 'text-sky-300';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function ResponseConsole({
  loading,
  result,
  error,
}: {
  loading: boolean;
  result: RequestResult | null;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#050816] p-4 font-mono text-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Awaiting response...
        </div>
        <div className="space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-900/50 bg-[#050816] p-4 font-mono text-sm">
        <p className="mb-2 text-rose-400">Network Error</p>
        <pre className="whitespace-pre-wrap text-rose-300/90">{error}</pre>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-[#050816] p-4 font-mono text-sm text-slate-600">
        Execute a request to see the live response console output here.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#050816] p-4 font-mono text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
        <span className={`font-bold tabular-nums ${getStatusTone(result.status)}`}>
          {result.status} {result.statusText}
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-500 tabular-nums">{result.durationMs}ms</span>
      </div>
      <pre
        className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlightJson(result.body) }}
      />
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: SandboxEndpoint }) {
  const [expanded, setExpanded] = useState(true);
  const [payload, setPayload] = useState(endpoint.defaultPayload);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((presetPayload: string) => {
    setPayload(presetPayload);
    setResult(null);
    setError(null);
  }, []);

  const execute = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    const started = performance.now();

    try {
      let url = endpoint.path;
      const init: RequestInit = { method: endpoint.method };

      if (endpoint.method === 'GET') {
        const parsed = JSON.parse(payload) as Record<string, string>;
        const params = new URLSearchParams(parsed);
        url = `${endpoint.path}?${params.toString()}`;
      } else {
        JSON.parse(payload);
        init.headers = { 'Content-Type': 'application/json' };
        init.body = payload;
      }

      const response = await fetch(url, init);
      const text = await response.text();
      const durationMs = Math.round(performance.now() - started);

      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        formatted = text || '(empty response body)';
      }

      setResult({
        status: response.status,
        statusText: response.statusText,
        durationMs,
        body: formatted,
        ok: response.ok,
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError(`Invalid JSON payload: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : 'Request failed');
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint.method, endpoint.path, payload]);

  const queryHint = useMemo(
    () =>
      endpoint.usesQueryParams
        ? 'Query parameters (JSON object → URL search params)'
        : 'Request body (JSON)',
    [endpoint.usesQueryParams]
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0b0f19] shadow-2xl shadow-black/40">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-4 border-b border-slate-800/80 px-6 py-5 text-left transition hover:bg-white/[0.02]"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wider ring-1 ${getMethodBadgeClass(endpoint.method)}`}
            >
              {endpoint.method}
            </span>
            <code className="text-sm text-slate-200">{endpoint.path}</code>
          </div>
          <h2 className="text-lg font-semibold text-white">{endpoint.title}</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
            {endpoint.description}
          </p>
          <p className="text-xs uppercase tracking-widest text-slate-600">
            DB: {endpoint.dbNote}
          </p>
        </div>
        <span className="mt-1 text-slate-500">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                {queryHint}
              </label>
              <textarea
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                spellCheck={false}
                rows={14}
                className="w-full resize-y rounded-xl border border-slate-700/80 bg-[#030712] p-4 font-mono text-[13px] leading-relaxed text-slate-200 outline-none ring-emerald-500/0 transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {endpoint.presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.payload)}
                  className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={execute}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#030712] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#030712]/30 border-t-[#030712]" />
                  Executing...
                </>
              ) : (
                'Execute Request'
              )}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Response Console
            </p>
            <ResponseConsole loading={loading} result={result} error={error} />
          </div>
        </div>
      )}
    </article>
  );
}

export function ApiSandboxDashboard() {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.06),_transparent_35%)]" />

      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Development Only
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">
            API Developer Sandbox
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-400">
            Interactive console for exercising every time-tracking endpoint against your local
            Next.js server. Edit payloads, fire real <code className="text-emerald-300">fetch()</code>{' '}
            calls, and inspect live responses — no Postman required.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-800">
              {SANDBOX_ENDPOINTS.length} endpoints
            </span>
            <span className="rounded-md bg-slate-900 px-2 py-1 ring-1 ring-slate-800">
              Base: same-origin /api/*
            </span>
          </div>
        </header>

        <div className="space-y-6">
          {SANDBOX_ENDPOINTS.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      </div>
    </div>
  );
}
