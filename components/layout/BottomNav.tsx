'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, User, ShieldCheck, BarChart2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import ThemeToggle from './ThemeToggle'
import { useUserStore } from '@/stores/userStore'

const BASE_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/habits', label: 'Habits', icon: Heart },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/summary', label: 'Summary', icon: BarChart2 },
  { href: '/profile', label: 'Profile', icon: User },
]

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'vithusan.business@gmail.com'
const VERSION_KEY = 'drivn_seen_version'

export default function BottomNav() {
  const pathname = usePathname()
  const profile = useUserStore((s) => s.profile)
  const [hasNewVersion, setHasNewVersion] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(VERSION_KEY)
    setHasNewVersion(seen !== APP_VERSION)
  }, [])

  // Mark as seen when user visits profile
  useEffect(() => {
    if (pathname === '/profile' && hasNewVersion) {
      localStorage.setItem(VERSION_KEY, APP_VERSION)
      setHasNewVersion(false)
    }
  }, [pathname, hasNewVersion])

  const navItems = profile?.email === ADMIN_EMAIL
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV

  return (
    <nav className={cn(
      'md:hidden fixed bottom-0 left-0 right-0',
      'bg-background/95 backdrop-blur-sm border-t border-border',
      'flex items-center justify-around pb-safe z-30',
      // `min-h` (not `h`) — `.pb-safe` adds env(safe-area-inset-bottom) as
      // padding-bottom. With a fixed `h-[60px]` that padding would eat into
      // the content box (border-box sizing) and squish the nav icons/labels
      // on notched phones. `min-h` lets the bar grow taller to fit icons +
      // safe-area inset without compressing anything.
      'min-h-[60px]'
    )}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        const showBadge = href === '/profile' && hasNewVersion
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              // `flex-1 min-w-0` lets each item shrink to share the bar width evenly —
              // with 6+ items (incl. Admin) plus the theme toggle, fixed `px-3` padding
              // pushed the total row width past narrow/portrait viewports.
              'flex-1 min-w-0 flex flex-col items-center gap-1 px-1 py-2 touch-target',
              'transition-colors duration-150',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              {showBadge && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-drivn-green border border-background" />
              )}
            </div>
            <span className="text-[10px] font-medium truncate max-w-full">{label}</span>
          </Link>
        )
      })}
      <ThemeToggle className="mb-1 flex-shrink-0" />
    </nav>
  )
}
