'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, User, ShieldCheck, BarChart2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from './ThemeToggle'
import { useUserStore } from '@/stores/userStore'

const BASE_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/habits', label: 'Habits', icon: Heart },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/summary', label: 'Summary', icon: BarChart2 },
  { href: '/profile', label: 'Profile', icon: User },
]

const ADMIN_EMAIL = 'vithusan.business@gmail.com'

export default function SideNav() {
  const pathname = usePathname()
  const profile = useUserStore((s) => s.profile)

  const navItems = profile?.email === ADMIN_EMAIL
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV

  return (
    <aside className={cn(
      'hidden md:flex flex-col',
      'fixed left-0 top-0 h-screen w-[220px]',
      'bg-background border-r border-border',
      'px-4 py-6 z-30'
    )}>
      {/* Brand */}
      <div className="mb-8 px-2">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Drivn"
            width={120}
            height={120}
            className="rounded-xl dark:invert"
            priority
          />
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: theme toggle */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-muted-foreground/50">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  )
}
