import { Link } from 'react-router'
import { MapPinOff } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex h-full items-center justify-center bg-paper">
      <div className="flex max-w-[380px] flex-col items-center gap-3 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sunken text-muted">
          <MapPinOff className="size-5" strokeWidth={1.8} />
        </span>
        <div className="text-[15px] font-semibold text-navy">Sahifa topilmadi</div>
        <div className="text-[12.5px] leading-relaxed text-muted">
          Siz izlagan manzil mavjud emas.
        </div>
        <Link
          to="/"
          className="mt-1 flex h-9 items-center rounded-card bg-leaf px-4 text-[13px] font-medium text-white transition-colors hover:bg-leaf-dark"
        >
          Xaritaga qaytish
        </Link>
      </div>
    </div>
  )
}
