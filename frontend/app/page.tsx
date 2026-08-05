import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { ToolsSection } from "@/components/tools-section"
import { CalloutBand } from "@/components/callout-band"
import { Showcase } from "@/components/showcase"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ToolsSection />
        <CalloutBand />
        <Showcase />
      </main>
      <SiteFooter />
    </div>
  )
}
