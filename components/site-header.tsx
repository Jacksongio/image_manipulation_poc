import { Search } from "lucide-react"

function Logo() {
  return (
    <a href="/" className="flex items-baseline gap-2 text-2xl font-extrabold tracking-tight md:text-[28px]">
      <span className="text-brand-green">PHOTO</span>
      <span className="text-brand-gray">FINALE</span>
    </a>
  )
}

const NAV_LINKS = [
  { label: "Magic Edit", href: "/magic-edit" },
  { label: "Art Style", href: "/art-style" },
  { label: "Image Upscaler", href: "/image-upscaler" },
  { label: "Border Expander", href: "/#border-expander" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Thin green utility strip */}
      <div className="bg-brand-green">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-1.5 text-xs font-semibold text-white sm:px-6 lg:px-8">
          <a href="#" className="transition-opacity hover:opacity-80">
            Support
          </a>
          <a href="#" className="transition-opacity hover:opacity-80">
            myLab
          </a>
        </div>
      </div>

      {/* Main white nav bar */}
      <div className="border-b border-black/5 bg-background">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-brand-navy transition-colors hover:text-brand-green"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              aria-label="Search"
              className="text-brand-green transition-transform hover:scale-110"
            >
              <Search className="size-5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Compact controls on small screens */}
          <div className="flex items-center gap-4 lg:hidden">
            <button type="button" aria-label="Search" className="text-brand-green">
              <Search className="size-5" strokeWidth={2.5} />
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}
