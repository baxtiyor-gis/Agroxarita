import { Outlet } from 'react-router'
import { Header } from '@/components/Header'

// Sidebar (statistika) hozircha yashirilgan — `@/components/Sidebar` saqlanadi, qaytarish uchun shu yerga qo'shing
export function MapLayout() {
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="relative min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
