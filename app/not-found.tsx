import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Page not found</h1>
      <Link
        href="/employee/track"
        className="mt-8 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
      >
        Back to Time Card
      </Link>
    </div>
  );
}
