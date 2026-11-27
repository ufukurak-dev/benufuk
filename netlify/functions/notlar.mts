// Kullanıcının notlarını saklar. Her kullanıcı sadece kendi notlarını görür.
import { getUser } from '@netlify/identity'
import { getStore } from '@netlify/blobs'
import type { Config } from '@netlify/functions'

type Not = { id: string; metin: string; zaman: string; bitti: boolean }

const cevap = (veri: unknown, status = 200) => Response.json(veri, { status })

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return cevap({ hata: 'Önce giriş yapmalısın.' }, 401)

  // Değişiklik yapan isteklerde başka sitelerden gelen istekleri reddet (CSRF koruması)
  if (req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (!origin || new URL(origin).host !== new URL(req.url).host) return cevap({ hata: 'Geçersiz istek.' }, 403)
  }

  const depo = getStore({ name: 'notlar', consistency: 'strong' })
  const notlar: Not[] = ((await depo.get(user.id, { type: 'json' })) as Not[] | null) ?? []

  if (req.method === 'GET') return cevap(notlar)

  let govde: { id?: string; metin?: string; bitti?: boolean }
  try { govde = await req.json() } catch { return cevap({ hata: 'Bozuk istek.' }, 400) }

  if (req.method === 'POST') {
    const metin = String(govde.metin ?? '').trim()
    if (!metin) return cevap({ hata: 'Not boş olamaz.' }, 400)
    if (metin.length > 2000) return cevap({ hata: 'Not çok uzun (en fazla 2000 karakter).' }, 400)
    if (notlar.length >= 2000) return cevap({ hata: 'Not sınırı doldu, eskileri silmelisin.' }, 400)
    notlar.unshift({ id: crypto.randomUUID(), metin, zaman: new Date().toISOString(), bitti: false })
  } else if (req.method === 'PATCH') {
    const n = notlar.find(x => x.id === govde.id)
    if (!n) return cevap({ hata: 'Not bulunamadı.' }, 404)
    n.bitti = Boolean(govde.bitti)
  } else if (req.method === 'DELETE') {
    const i = notlar.findIndex(x => x.id === govde.id)
    if (i < 0) return cevap({ hata: 'Not bulunamadı.' }, 404)
    notlar.splice(i, 1)
  } else {
    return cevap({ hata: 'Desteklenmeyen işlem.' }, 405)
  }

  await depo.setJSON(user.id, notlar)
  return cevap(notlar)
}

export const config: Config = { path: '/api/notlar' }
