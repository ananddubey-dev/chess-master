import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10">
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <Link className="text-lg font-bold tracking-tight text-slate-900" href="/">
          Kingdom <span className="text-blue-700">of Chess</span>
        </Link>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
          Tournament platform
        </span>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Learn. Play. Compete.
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
          Every move brings your next challenge closer.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          A focused home for student tournaments, fair matchmaking, and live
          chess. Sign-in and tournament features are coming as the foundation
          is built.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <span className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white">
            Tournament experience
          </span>
          <span className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
            Live games powered by Socket.IO
          </span>
        </div>
      </section>
      <footer className="border-t border-slate-200 py-5 text-sm text-slate-500">
        A calm, fair place to play your next game.
      </footer>
    </main>
  );
}
