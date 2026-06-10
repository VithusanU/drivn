'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, User, ShieldCheck, BarChart2, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from './ThemeToggle'
import { useUserStore } from '@/stores/userStore'
import { useUIStore, readStoredSidebarCollapsed } from '@/stores/uiStore'

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
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)

  // Restore persisted preference on mount
  useEffect(() => {
    setSidebarCollapsed(readStoredSidebarCollapsed())
  }, [setSidebarCollapsed])

  const navItems = profile?.email === ADMIN_EMAIL
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV

  return (
    <aside className={cn(
      'hidden md:flex flex-col',
      'fixed left-0 top-0 h-screen',
      'bg-background border-r border-border',
      'py-6 z-30 transition-[width] duration-200',
      collapsed ? 'w-[68px] px-2' : 'w-[220px] px-4'
    )}>
      {/* Brand + collapse toggle */}
      <div className={cn('mb-8 flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
        <Link href="/" className={cn(collapsed && 'hidden')}>
          <Image
            src="/logo.png"
            alt="Drivn"
            width={120}
            height={120}
            className="rounded-xl dark:invert"
            priority
          />
        </Link>
        {collapsed && (
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Drivn"
              width={32}
              height={32}
              className="rounded-lg dark:invert"
              priority
            />
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-secondary',
            collapsed && 'absolute -right-3 top-7 bg-background border border-border shadow-sm hover:bg-background'
          )}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'px-3',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: theme toggle */}
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between px-2')}>
        {!collapsed && <span className="text-xs text-muted-foreground/50">Theme</span>}
        <ThemeToggle />
      </div>
    </aside>
  )
}
