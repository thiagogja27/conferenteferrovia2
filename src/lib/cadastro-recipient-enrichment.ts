import { getCustomDestinatarios, saveCustomDestinatario } from './cadastros-logisticos-service'

const INVALID_NAMES = /^(?:não informado|nao informado|destinatário não identificado|destinatario nao identificado)$/i
const ENRICHMENT_LOG_KEY = 'vlic_recipient_enrichment_log_v1'

export interface RecipientEnrichmentLog {
  id: string
  cnpj: string
  nomeAnterior: string
  nomeAssociado: string
  origem: 'NF-e'
  ocorridoEm: number
}

export function getRecipientEnrichmentLog(): RecipientEnrichmentLog[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(ENRICHMENT_LOG_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function registerRecipientEnrichment(entry: Omit<RecipientEnrichmentLog, 'id' | 'ocorridoEm'>): void {
  if (typeof window === 'undefined') return
  const next: RecipientEnrichmentLog = { ...entry, id: `enrichment-${Date.now()}`, ocorridoEm: Date.now() }
  const log = [next, ...getRecipientEnrichmentLog()].slice(0, 500)
  localStorage.setItem(ENRICHMENT_LOG_KEY, JSON.stringify(log))
  window.dispatchEvent(new CustomEvent('recipient_enrichment_registered'))
}

export function clearRecipientEnrichmentLog(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ENRICHMENT_LOG_KEY)
    window.dispatchEvent(new CustomEvent('recipient_enrichment_registered'))
  }
}

export async function enrichRecipientCadastroFromNfe(cnpj?: string, nome?: string): Promise<boolean> {
  const cleanCnpj = (cnpj || '').replace(/\D/g, '')
  const cleanNome = (nome || '').trim().replace(/\s+/g, ' ')
  if (cleanCnpj.length !== 14 || cleanNome.length < 3 || INVALID_NAMES.test(cleanNome)) return false

  const cadastro = getCustomDestinatarios().find((item) =>
    [item.cnpjPrincipal, ...(item.cnpjsAdicionais || [])]
      .map((value) => value.replace(/\D/g, ''))
      .some((value) => value === cleanCnpj || (value.length === 8 && cleanCnpj.startsWith(value)))
  )
  if (!cadastro || cadastro.nome.trim().length >= 3) return false

  const nomeAssociado = cleanNome.toUpperCase()
  await saveCustomDestinatario({
    ...cadastro,
    nome: nomeAssociado,
    nomenclatura: cadastro.nomenclatura || nomeAssociado,
  })
  registerRecipientEnrichment({
    cnpj: cleanCnpj,
    nomeAnterior: cadastro.nome || '(sem nome)',
    nomeAssociado,
    origem: 'NF-e',
  })
  return true
}
