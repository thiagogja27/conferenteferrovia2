import { getCustomDestinatarios, saveCustomDestinatario } from './cadastros-logisticos-service'

const INVALID_NAMES = /^(?:não informado|nao informado|destinatário não identificado|destinatario nao identificado)$/i

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

  await saveCustomDestinatario({
    ...cadastro,
    nome: cleanNome.toUpperCase(),
    nomenclatura: cadastro.nomenclatura || cleanNome.toUpperCase(),
  })
  return true
}
