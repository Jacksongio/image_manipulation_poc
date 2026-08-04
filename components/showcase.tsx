import { Check } from "lucide-react"

const POINTS = [
  "One platform for Magic Edit, Art Style, Image Upscaler, and Border Expander",
  "Print-ready output that keeps every order looking sharp",
  "Built into your website, kiosk, and mobile app",
]

export function Showcase() {
  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <img
              src="/showcase-upscale.png"
              alt="Before and after comparison of a portrait photo enhanced with the AI Image Upscaler"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-green-dark">Photo Finale Platform</p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-brand-navy md:text-4xl">
            Grow your business, delight customers, and maximize profits.
          </h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-brand-green" />

          <p className="mt-6 leading-relaxed text-muted-foreground">
            We offer a powerful, all-in-one suite of AI photo tools designed to help you sell more prints and
            personalized products. From instant retouching to intelligent upscaling, we have every step of the
            creative workflow covered.
          </p>

          <ul className="mt-6 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-green">
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                </span>
                <span className="text-sm leading-relaxed text-brand-navy">{point}</span>
              </li>
            ))}
          </ul>

          <a
            href="#contact"
            className="mt-9 inline-flex items-center justify-center rounded-full bg-brand-navy px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
          >
            Request A Demo
          </a>
        </div>
      </div>
    </section>
  )
}
