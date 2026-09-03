type DevelopmentAdminRedirectOptions = {
  adminOrigin: string;
  nodeEnvironment: string | undefined;
  pathname: string;
  requestHost: string | null;
};

const LOOPBACK_HOSTS = new Set([
  "127.0.0.1",
  "[::1]",
  "localhost",
]);

export function resolveDevelopmentAdminRedirect({
  adminOrigin,
  nodeEnvironment,
  pathname,
  requestHost,
}: DevelopmentAdminRedirectOptions) {
  if (
    nodeEnvironment !== "development" ||
    !requestHost ||
    !pathname.startsWith("/admin")
  ) {
    return null;
  }

  let configured: URL;
  let requested: URL;

  try {
    configured = new URL(adminOrigin);
    requested = new URL(
      `${configured.protocol}//${requestHost}`
    );
  } catch {
    return null;
  }

  if (requested.origin === configured.origin) {
    return null;
  }

  if (
    requested.protocol !== configured.protocol ||
    requested.port !== configured.port ||
    !LOOPBACK_HOSTS.has(requested.hostname) ||
    !LOOPBACK_HOSTS.has(configured.hostname)
  ) {
    return null;
  }

  return new URL(pathname, configured).toString();
}
