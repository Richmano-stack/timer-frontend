export function isDevSandboxEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_DEV_SANDBOX === 'true'
  );
}
