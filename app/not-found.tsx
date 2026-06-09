import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Page not found</h1>
      <Link
        href="/employee/track"
        className="mt-8 rounded-xl bg-brand-accent px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Back to Time Card
      </Link>
    </div>
  );
}
