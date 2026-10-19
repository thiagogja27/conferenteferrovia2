import {
  resolveDestinatarioCadastro,
  resolveSavedNoteDestinatario,
} from './cadastros-logisticos-service'
import { enrichRecipientCadastroFromNfe } from './cadastro-recipient-enrichment'
import type { NFEData } from './nfe-parser'
import {
  generateNFeXML,
  formatCNPJStr,
  type ParsedNFeData,
} from './pdf-text-parser'

export function normalizeNfeRecipient<T extends NFEData>(nfeData: T): T {
  const rawCnpj = nfeData.destinatario?.cpfCnpj || ''
  if (rawCnpj.replace(/\D/g, '').length !== 14) return nfeData

  // Atualiza apenas cadastros personalizados sem nome; nunca sobrescreve um nome existente.
  void enrichRecipientCadastroFromNfe(rawCnpj, nfeData.destinatario?.nome).catch((error) => {
    console.warn('[Cadastro] Não foi possível enriquecer destinatário:', error)
  })

  const recipient = resolveDestinatarioCadastro(undefined, rawCnpj)
  if (!recipient) return nfeData

  return {
    ...nfeData,
    destinatario: {
      ...nfeData.destinatario,
      nome: recipient.nome,
      cpfCnpj: formatCNPJStr(recipient.cnpj),
    },
  }
}

export async function prioritizeSavedRecipient<T extends {
  xml?: string
  parsedData?: ParsedNFeData
}>(item: T): Promise<T> {
  const parsedData = item.parsedData
  if (!parsedData) return item

  void enrichRecipientCadastroFromNfe(parsedData.destCNPJ, parsedData.destNome).catch((error) => {
    console.warn('[Cadastro] Não foi possível enriquecer destinatário:', error)
  })

  const recipient =
    resolveDestinatarioCadastro(parsedData.destNome, parsedData.destCNPJ) ||
    (await resolveSavedNoteDestinatario(
      parsedData.destNome,
      parsedData.destCNPJ,
      parsedData.rawSnippet
    ))

  let updatedData = recipient
    ? {
        ...parsedData,
        destNome: recipient.nome,
        destCNPJ: recipient.cnpj ? formatCNPJStr(recipient.cnpj) : parsedData.destCNPJ,
      }
    : parsedData

  if ((!updatedData.destNome || updatedData.destNome === 'Não informado' || updatedData.destNome === 'DESTINATÁRIO NÃO IDENTIFICADO') && updatedData.emitNome) {
    updatedData = {
      ...updatedData,
      destNome: updatedData.emitNome.toUpperCase(),
      destCNPJ: updatedData.destCNPJ || updatedData.emitCNPJ || '',
    }
  }

  return {
    ...item,
    parsedData: updatedData,
    xml: generateNFeXML(updatedData),
  }
}
