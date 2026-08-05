type IconProps = { className?: string }

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  )
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.66l7.73-8.84L1.24 2.25h6.83l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05L17.08 19.77Z" />
    </svg>
  )
}

function LinkedinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8ZM9.6 15.6V8.4l6.25 3.6-6.25 3.6Z" />
    </svg>
  )
}

const SOCIALS = [
  { label: "Facebook", icon: FacebookIcon },
  { label: "X", icon: XIcon },
  { label: "LinkedIn", icon: LinkedinIcon },
  { label: "YouTube", icon: YoutubeIcon },
]

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-black/5 bg-muted/60">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-2">
          <div className="flex items-baseline gap-2 text-2xl font-extrabold tracking-tight">
            <span className="text-brand-green">PHOTO</span>
            <span className="text-brand-gray">FINALE</span>
          </div>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
            <span className="font-bold text-brand-navy">Photo Finale</span>, a software company based near Washington,
            D.C., provides comprehensive AI imaging tools for photofinishing retailers around the globe. Our suite —
            Magic Edit, Art Style, Image Upscaler, and Border Expander — powers self-service kiosks, ecommerce photo
            ordering, and fully branded mobile apps, giving customers a seamless creative experience from upload to
            print.
          </p>

          <div className="mt-6 flex gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="flex size-10 items-center justify-center rounded-full bg-brand-navy text-white transition-colors hover:bg-brand-green"
              >
                <s.icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-brand-navy">Contact Us</h3>
          <address className="mt-4 space-y-1 not-italic leading-relaxed text-muted-foreground">
            <p>880 Harrison St SE, #150</p>
            <p>Leesburg, VA 20175</p>
            <p>USA</p>
          </address>
          <p className="mt-4 text-muted-foreground">+1 703-564-3400</p>
          <div className="mt-4 space-y-1">
            <a href="mailto:info@photofinale.com" className="block font-semibold text-accent-orange hover:underline">
              info@photofinale.com
            </a>
            <a href="mailto:support@photofinale.com" className="block font-semibold text-accent-orange hover:underline">
              support@photofinale.com
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-black/5">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} Photo Finale Inc. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
