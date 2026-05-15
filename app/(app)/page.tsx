import AppHeader from '@/components/layout/AppHeader'
import NextBestAction from '@/components/dashboard/NextBestAction'
import TaskGroups from '@/components/dashboard/TaskGroups'
import HabitStrip from '@/components/dashboard/HabitStrip'
import MomentumCard from '@/components/dashboard/MomentumCard'
import QuickCapture from '@/components/dashboard/QuickCapture'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />

      <div className="flex-1 px-4 pb-6 space-y-6 overflow-y-auto no-scrollbar scroll-momentum">
        {/* Core: Next Best Action */}
        <NextBestAction />

        {/* Task Groups: Now / Soon / Later */}
        <TaskGroups />

        {/* Habits strip */}
        <section>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Today&apos;s habits
          </p>
          <HabitStrip />
        </section>

        {/* Momentum */}
        <section>
          <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-3">
            Momentum
          </p>
          <MomentumCard />
        </section>
      </div>

      {/* Persistent quick capture */}
      <QuickCapture />
    </div>
  )
}
