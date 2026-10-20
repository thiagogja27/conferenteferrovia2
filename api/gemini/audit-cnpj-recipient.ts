import { getGatewayAI } from './gateway-client'

type ApiRequest = { method?: string; body?: any }
type ApiResponse = { status: (code: number) => ApiResponse; json: (body: unknown) => void }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const items = Array.isArray(req.body?.items) ? req.body.items : []
  if (items.length === 0) return res.status(400).json({ error: 'Nenhuma nota para auditar' })

  const compactItems = items.slice(0, 200).map((item: any) => ({
    id: item.id,
    numero: item.numero,
    chave: item.chave,
    cnpjNaChave: item.chaveCnpjRaw,
    cnpjDestinatarioExtraido: item.destCNPJ,
    destinatario: item.destNome,
    emitente: item.emitNome,
    detalhesSistema: item.statusDetails,
  }))

  const prompt = `Audite estas notas fiscais brasileiras para validar exclusivamente CNPJ da chave de acesso versus CNPJ real do destinatário.

Regras obrigatórias:
- A chave de acesso tem 44 dígitos; o CNPJ da chave são os dígitos 7 a 20.
- Compare apenas com o CNPJ/CPF do campo fiscal DESTINATÁRIO (tag XML dest/CNPJ ou dest/CPF, ou rótulo explícito no DANFE).
- Nunca considere Inscrição Estadual, CNPJ de transportadora, emitente, dados adicionais ou informações complementares como destinatário.
- Se o destinatário extraído não for confiável, retorne NAO_INFORMADO, não invente nem corrija por aproximação.
- Retorne somente JSON válido neste formato: {"resultados":[{"id":"...","veredito":"CONFORME|DIVERGENTE|NAO_INFORMADO","cnpjChave":"...","cnpjDestinatario":"...","confianca":"ALTA|MEDIA|BAIXA","explicacao":"..."}]}

Notas:
${JSON.stringify(compactItems)}`

  try {
    const ai = getGatewayAI()
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: 'Você é um auditor fiscal rigoroso. Não use dados de informações complementares para identificar destinatário.' },
    })
    const text = result.text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(text)
    return res.status(200).json({ ...parsed, provedor: 'VERCEL_AI_GATEWAY', totalAuditados: compactItems.length })
  } catch (error) {
    console.error('[CNPJ Audit] Falha na auditoria IA:', error)
    return res.status(502).json({ error: 'Não foi possível concluir a auditoria por IA' })
  }
}
