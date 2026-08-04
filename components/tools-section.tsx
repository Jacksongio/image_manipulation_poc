import { Wand2, Palette, ScanSearch, Frame, type LucideIcon } from "lucide-react"

type Tool = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
}

const TOOLS: Tool[] = [
  {
    id: "magic-edit",
    title: "Magic Edit",
    description: "Remove objects, fix blemishes, and retouch any photo in a single tap with smart AI selections.",
    icon: Wand2,
    iconColor: "text-accent-pink",
    iconBg: "bg-accent-pink/10",
  },
  {
    id: "art-style",
    title: "Art Style",
    description: "Transform ordinary photos into paintings, sketches, and signature looks with one-click art styles.",
    icon: Palette,
    iconColor: "text-accent-orange",
    iconBg: "bg-accent-orange/10",
  },
  {
    id: "image-upscaler",
    title: "Image Upscaler",
    description: "Turn small, blurry images into crisp, print-ready photos with up to 4x AI resolution.",
    icon: ScanSearch,
    iconColor: "text-brand-green-dark",
    iconBg: "bg-brand-green/15",
  },
  {
    id: "border-expander",
    title: "Border Expander",
    description: "Extend backgrounds naturally to fit any print size — no more awkward crops or empty edges.",
    icon: Frame,
    iconColor: "text-accent-teal",
    iconBg: "bg-accent-teal/10",
  },
]

export function ToolsSection() {
  return (
    <section id="tools" className="bg-muted/60 pb-20 pt-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-accent-pink">AI Photo Tools</p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-brand-navy md:text-4xl">
            Engineered to deliver an exceptional editing experience and print-perfect results.
          </h2>
          <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-accent-pink" />
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <article
              key={tool.id}
              id={tool.id}
              className="group scroll-mt-28 rounded-2xl bg-card p-7 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`flex size-14 items-center justify-center rounded-full ${tool.iconBg}`}>
                <tool.icon className={`size-7 ${tool.iconColor}`} strokeWidth={2} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-brand-navy">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
              <a
                href={tool.id === "magic-edit" ? "/magic-edit" : "#contact"}
                className={`mt-4 inline-flex text-sm font-bold ${tool.iconColor} opacity-0 transition-opacity group-hover:opacity-100`}
              >
                {tool.id === "magic-edit" ? "Open editor" : "Learn more"} &rarr;
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
