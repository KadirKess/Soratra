import { auth } from '@/server/auth'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { MobileHeader } from './MobileHeader'
import { ProjectCredit } from './ProjectCredit'
import { siteConfig } from '@/lib/config'

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    return <>{children}<ProjectCredit /></>
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar supportEmail={siteConfig.supportEmail} />
      <div className="app-shell-content flex-1 flex flex-col md:ml-56">
        <div className="hidden md:block">
          <TopBar />
        </div>

        <MobileHeader />

        {/* Extra mobile padding clears the floating bottom navigation. */}
        <main id="main-content" className="flex-1 p-4 pt-5 md:p-6 pb-32 md:pb-6 max-w-6xl w-full mx-auto app-shell-main">
          <div className="relative z-0">{children}</div>
        </main>
        <ProjectCredit />
      </div>

      <BottomNav />
    </div>
  )
}
