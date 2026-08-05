import { ArrowUp } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-navy">
      {/* Decorative upward arrows watermark, echoing the reference */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 opacity-[0.06] lg:block">
        <div className="flex h-full items-center justify-center gap-6">
          {[0, 1, 2].map((i) => (
            <ArrowUp key={i} className="size-40 text-white" strokeWidth={1} style={{ marginTop: i * 40 }} />
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6 md:pt-24 lg:px-8">
        <h1 className="text-balance text-4xl font-extrabold leading-tight text-white md:text-6xl">
          Smarter Edits. Stunning Photos.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/80 md:text-lg">
          Photo Finale delivers a powerful suite of AI photo tools — retouch, restyle, upscale, and expand every
          image so businesses can sell prints and personalized photo products that wow.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#tools"
            className="inline-flex items-center justify-center rounded-full bg-brand-green px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-brand-navy shadow-lg shadow-black/20 transition-colors hover:bg-brand-green-dark hover:text-white"
          >
            Explore The Tools
          </a>
          <a
            href="#contact"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-brand-navy transition-colors hover:bg-white/90"
          >
            Request A Demo
          </a>
        </div>
      </div>

      {/* Feature image floating over the fold */}
      <div className="relative mx-auto -mb-24 max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl shadow-2xl shadow-black/30 ring-1 ring-white/10">
          <img
            src="/hero-editing.png"
            alt="Editing a vibrant landscape photograph with AI enhancement tools on a desktop monitor"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  )
}
