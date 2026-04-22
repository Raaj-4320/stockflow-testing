import { useCallback, useEffect, useMemo, useState } from 'react';

type VersionPayload = {
  version: string;
  deployedAt?: string;
  targetUrl?: string;
};

const POLL_INTERVAL_MS = 60_000;

const isValidVersionPayload = (value: unknown): value is VersionPayload => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as VersionPayload;
  if (typeof payload.version !== 'string' || !payload.version.trim()) return false;
  if (payload.version.includes('__APP_BUILD_ID__')) return false;
  return true;
};

export const useVersionCheck = (currentVersion: string) => {
  const [latest, setLatest] = useState<VersionPayload | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch(`/version.json?ts=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const parsed: unknown = await response.json();
      if (!isValidVersionPayload(parsed)) return;
      if (parsed.version === currentVersion) return;
      setLatest((prev) => (prev?.version === parsed.version ? prev : parsed));
    } catch {
      // Intentionally silent: version checks should never impact app behavior.
    }
  }, [currentVersion]);

  useEffect(() => {
    void checkVersion();
    const onFocus = () => { void checkVersion(); };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => { void checkVersion(); }, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [checkVersion]);

  const updateAvailable = useMemo(() => {
    if (!latest) return false;
    if (latest.version === dismissedVersion) return false;
    return latest.version !== currentVersion;
  }, [latest, dismissedVersion, currentVersion]);

  const dismissUpdate = useCallback(() => {
    if (!latest) return;
    setDismissedVersion(latest.version);
  }, [latest]);

  return {
    updateAvailable,
    latestVersionData: latest,
    dismissUpdate,
    checkVersion,
  };
};
