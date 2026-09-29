import type { ReactNode } from 'react'
import { Home, Minus, Plus } from 'lucide-react'
import { LayersControl } from './LayersControl'
import { Panel } from '@/components/ui/Panel'

function Tugma({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      title={title}
      className="flex size-10 items-center justify-center text-body transition-colors hover:bg-sunken hover:text-navy"
    >
      {children}
    </button>
  )
}

interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onHome: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onHome }: Props) {
  return (
    <div className="absolute top-3 right-3 z-20">
      <Panel className="flex flex-col divide-y divide-line !overflow-visible">
        <Tugma title="Yaqinlashtirish" onClick={onZoomIn}>
          <Plus className="size-4" />
        </Tugma>
        <Tugma title="Uzoqlashtirish" onClick={onZoomOut}>
          <Minus className="size-4" />
        </Tugma>
        <Tugma title="Boshlang'ich ko'rinish" onClick={onHome}>
          <Home className="size-4" />
        </Tugma>
        <LayersControl />
      </Panel>
    </div>
  )
}
