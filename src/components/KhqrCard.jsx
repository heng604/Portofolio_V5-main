import { QRCodeSVG } from 'qrcode.react'

export const formatAmount = (amount, currency) =>
  currency === 'KHR'
    ? Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Bakong KHQR card styled like the reference screenshot:
 * red header with KHQR logo + angled corner, white body, recipient name, amount + currency,
 * dotted separator and a large scannable QR with the Bakong logo in the centre.
 * `qr` MUST be the real EMV payload returned by the server (never a placeholder).
 */
export default function KhqrCard({ name, amount, currency, qr, dimmed = false, size = 240 }) {
  return (
    <div className="w-[300px] max-w-full mx-auto bg-white text-[#1a1a1a] rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.45)] select-none"
         role="img" aria-label={`KHQR for ${name}, ${formatAmount(amount, currency)} ${currency}`}>
      {/* Header */}
      <div className="relative bg-[#E1232E] h-[72px]"
           style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, calc(100% - 38px) calc(100% - 22px), 0 calc(100% - 22px))' }}>
        <img src="/bakong/khqr-logo.png" alt="KHQR" className="absolute left-1/2 top-[8px] -translate-x-1/2 h-[34px] w-auto" draggable="false" />
      </div>

      {/* Recipient + amount */}
      <div className="px-6 pt-3 pb-4">
        <p className="text-[17px] leading-snug text-[#333] truncate" title={name}>{name}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[26px] font-extrabold tracking-tight">{formatAmount(amount, currency)}</span>
          <span className="text-[13px] text-[#555]">{currency}</span>
        </p>
      </div>

      {/* Dotted separator */}
      <div className="border-t-[1.5px] border-dashed border-[#9a9a9a] mx-0" />

      {/* QR */}
      <div className="px-4 py-5 flex justify-center">
        <div className={`relative transition-opacity ${dimmed ? 'opacity-30' : ''}`}>
          <QRCodeSVG
            value={qr}
            size={size}
            level="Q"
            marginSize={0}
            fgColor="#000000"
            bgColor="#ffffff"
            imageSettings={{ src: '/bakong/bakong-logo.png', width: Math.round(size * 0.17), height: Math.round(size * 0.17), excavate: true }}
          />
        </div>
      </div>
    </div>
  )
}
