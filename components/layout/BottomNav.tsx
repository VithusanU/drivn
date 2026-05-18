'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, User, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from './ThemeToggle'
import { useUserStore } from '@/stores/userStore'

const BASE_NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/habits', label: 'Habits', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
]

const ADMIN_EMAIL = 'vithusan.business@gmail.com'

export default function BottomNav() {
  const pathname = usePathname()
  const profile = useUserStore((s) => s.profile)

  const navItems = profile?.email === ADMIN_EMAIL
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV

  return (
    <nav className={cn(
      'md:hidden fixed bottom-0 left-0 right-0',
      'bg-background/95 backdrop-blur-sm border-t border-border',
      'flex items-center justify-around pb-safe z-30',
      'h-[60px]'
    )}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 px-6 py-2 touch-target',
              'transition-colors duration-150',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
      <ThemeToggle className="mb-1" />
    </nav>
  )
}
