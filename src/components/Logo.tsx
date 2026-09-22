/**
 * Agroxarita belgisi — kadastr konturi ichida o'sayotgan nihol.
 *
 * Ranglar to'g'ridan-to'g'ri yozilgan: SVG ichida CSS o'zgaruvchilari
 * `currentColor` dan boshqa holatlarda ishonchsiz ishlaydi.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      {/* Uchastka konturi */}
      <path
        d="M4 9.5 15.2 3.2a1.6 1.6 0 0 1 1.6 0L28 9.5v13a1.6 1.6 0 0 1-.8 1.4l-10.4 6a1.6 1.6 0 0 1-1.6 0l-10.4-6A1.6 1.6 0 0 1 4 22.5v-13Z"
        fill="#e4f0e8"
        stroke="#2f7d4f"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Poya */}
      <path d="M16 23.2v-7.6" stroke="#23603c" strokeWidth="1.9" strokeLinecap="round" />
      {/* Chap barg */}
      <path d="M16 17.2c-3.5 0-5.1-1.9-5.1-4.5 3-.5 5.1 1.1 5.1 4.5Z" fill="#2f7d4f" />
      {/* O'ng barg — biroz yuqoriroq, tabiiy assimetriya */}
      <path d="M16 14.7c0-3.3 1.9-4.9 4.7-4.5-.1 3.1-1.7 4.7-4.7 4.5Z" fill="#23603c" />
      {/* Quyosh — bug'doy rangi */}
      <circle cx="22.7" cy="7.3" r="2.2" fill="#b07d2a" />
    </svg>
  )
}
