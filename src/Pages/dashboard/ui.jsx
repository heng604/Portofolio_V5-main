import { useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { UploadCloud, Loader2 } from 'lucide-react'
import { supabase } from '../../supabase'

export const toast = (icon, title) =>
  Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2600, timerProgressBar: true, background: '#0b0820', color: '#fff' })

export const confirmDestructive = async (title, text) =>
  (await Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', cancelButtonColor: '#374151', background: '#0b0820', color: '#fff', focusCancel: true })).isConfirmed

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl ${className}`}>{children}</div>
)

export const PageHeader = ({ icon: Icon, title, subtitle, children }) => (
  <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-xl blur opacity-50" />
        <div className="relative w-9 h-9 bg-[#030014] rounded-xl border border-white/15 flex items-center justify-center"><Icon className="w-4 h-4 text-indigo-400" /></div>
      </div>
      <div><h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>{subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}</div>
    </div>
    <div className="flex items-center gap-2 flex-wrap">{children}</div>
  </div>
)

export const inputCls = 'w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-indigo-500/60 transition-colors'
export const btnPrimary = 'px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-[#4f52c9] to-[#8644c5] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity'
export const btnGhost = 'px-3 py-2 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-50 transition-colors'

// Drag & drop uploader with type/size validation, preview and persistent storage in a Supabase bucket.
export function FileDrop({ bucket, accept, maxMB = 5, value, onUploaded, label = 'Drop a file here or click to browse', pdf = false }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState(null)

  const handle = async (file) => {
    if (!file) return
    if (!accept.split(',').map((s) => s.trim()).includes(file.type)) return toast('error', `Unsupported type: ${file.type || 'unknown'}`)
    if (file.size > maxMB * 1024 * 1024) return toast('error', `File too large (max ${maxMB} MB)`)
    if (file.type.startsWith('image/')) setPreview(URL.createObjectURL(file))
    setBusy(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${Date.now()}-${safe}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
    setBusy(false)
    if (error) { setPreview(null); return toast('error', error.message) }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onUploaded(data.publicUrl)
    toast('success', 'Uploaded')
  }

  const shown = preview || (!pdf && value)
  return (
    <div>
      <div role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]) }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors ${drag ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/15 hover:border-white/30'}`}>
        {busy ? <Loader2 className="w-5 h-5 mx-auto animate-spin text-indigo-400" /> : <UploadCloud className="w-5 h-5 mx-auto text-gray-500" />}
        <p className="mt-1 text-gray-400">{label}</p>
        <p className="text-[11px] text-gray-600">max {maxMB} MB</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {shown && <img src={shown} alt="Preview" className="mt-3 max-h-32 rounded-lg border border-white/10" />}
      {value && <a href={value} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-indigo-300 break-all hover:underline">{value}</a>}
    </div>
  )
}
