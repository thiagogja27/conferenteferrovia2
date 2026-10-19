'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  HardDrive,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileSpreadsheet,
  Radio,
  Users,
  Lightbulb,
  Layers,
  ArrowRight,
  Info,
  Server,
  Zap,
  Monitor,
  BarChart3,
  CheckSquare,
  Square,
  Building2,
  Check,
  PiggyBank,
  TrendingDown,
  Sliders,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react'
import {
  fetchDatabaseStorageStats,
  getInitialStorageStats,
  formatBytes,
  optimizeDatabaseSmart,
  purgeConferenceHistory,
  purgeInputFiles,
  purgeActivities,
  purgeOfflinePresence,
  purgeResolvedSuggestions,
  clearBrowserLocalStorage,
  purgeAllTelemetry,
  purgeSingleNode,
  purgeSelectedNodes,
  purgeAllTelemetryColumns,
  purgeEntireVlicTelemetryRoot,
  purgeAllResidualKeysAndTitles,
  purgeDatabasePreservingOnlyUsersAndDepartments,
  getDatabaseEconomySettings,
  saveDatabaseEconomySettings,
  applyDatabaseEconomyNow,
  type DatabaseStorageStats,
  type StorageNodeMetric,
  type DatabaseEconomySettings,
} from '@/lib/database-optimization-service'
import { clearConferenceDashboardHistory } from '@/lib/conference-dashboard-sync'

interface DatabaseStorageManagerProps {
  onNotify?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void
}

export function DatabaseStorageManager({ onNotify }: DatabaseStorageManagerProps) {
  // Inicialização instantânea (0ms) a partir de métricas locais: a tela NUNCA fica travada
  const [stats, setStats] = useState<DatabaseStorageStats>(() => getInitialStorageStats())
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)

  // Seleção múltipla de colunas para limpeza em lote
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  // Modal para limpeza de uma única coluna
  const [nodeToPurge, setNodeToPurge] = useState<{ path: string; label: string; count: number; bytes: number } | null>(null)

  // Modal para limpeza de todas as colunas
  const [isBulkPurgeModalOpen, setIsBulkPurgeModalOpen] = useState(false)
  const [preserveUsersInBulk, setPreserveUsersInBulk] = useState(true)

  // Modal de Confirmação de Limpeza Total Raiz
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false)
  const [dangerConfirmText, setDangerConfirmText] = useState('')

  // Modal de Confirmação de Wipe Total Mantendo Apenas Usuários e Departamentos
  const [isWipeKeepUsersModalOpen, setIsWipeKeepUsersModalOpen] = useState(false)
  const [wipeConfirmText, setWipeConfirmText] = useState('')

  // Modal e controle de apagar títulos e chaves residuais
  const [isPurgeResidualKeysModalOpen, setIsPurgeResidualKeysModalOpen] = useState(false)
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false)
  const [copiedRules, setCopiedRules] = useState(false)
  const [rulesTab, setRulesTab] = useState<'rbac' | 'open'>('rbac')

  // Configurações de Economia e Redução de Gastos
  const [economySettings, setEconomySettings] = useState<DatabaseEconomySettings>(() => getDatabaseEconomySettings())
  const [isApplyingEconomy, setIsApplyingEconomy] = useState(false)
  const [showEconomyDetails, setShowEconomyDetails] = useState(false)

  const handleUpdateEconomyMode = (mode: 'extreme' | 'standard' | 'custom') => {
    const updated = saveDatabaseEconomySettings({
      economyMode: mode,
      maxConferenceMirrors: mode === 'extreme' ? 1 : mode === 'standard' ? 3 : economySettings.maxConferenceMirrors,
      maxInputFilesHistory: mode === 'extreme' ? 30 : mode === 'standard' ? 100 : economySettings.maxInputFilesHistory,
      maxActivitiesHistory: mode === 'extreme' ? 30 : mode === 'standard' ? 100 : economySettings.maxActivitiesHistory,
      slimConferencePayload: true,
      autoPruningEnabled: true,
    })
    setEconomySettings(updated)
    onNotify?.(
      `Modo Econômico configurado para: ${mode === 'extreme' ? 'Extremo (Custo Zero)' : mode === 'standard' ? 'Padrão Otimizado' : 'Personalizado'}.`,
      'info'
    )
  }

  const handleApplyEconomyNow = async () => {
    setIsApplyingEconomy(true)
    try {
      const res = await applyDatabaseEconomyNow()
      await loadStats()
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao aplicar modo econômico: ${err?.message || 'Falha na operação.'}`, 'error')
    } finally {
      setIsApplyingEconomy(false)
    }
  }

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const result = await fetchDatabaseStorageStats()
      if (result) {
        setStats(result)
      }
    } catch (e) {
      console.warn('Erro ao carregar estatísticas:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  // Otimização Inteligente em 1 Clique
  const handleSmartOptimization = async () => {
    setIsOptimizing(true)
    try {
      const res = await optimizeDatabaseSmart()
      await loadStats()
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro na otimização: ${err?.message || 'Falha ao compactar banco.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Ações Seletivas
  const handleAction = async (key: string, fn: () => Promise<any>, successMsg: string) => {
    setActionLoadingKey(key)
    try {
      const res = await fn()
      await loadStats()
      const freedStr = res?.freedBytes ? ` (${formatBytes(res.freedBytes)} liberados)` : ''
      onNotify?.(`${successMsg}${freedStr}`, 'success')
    } catch (err: any) {
      onNotify?.(`Erro: ${err?.message || 'Falha na operação.'}`, 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  // Limpar Coluna Individual
  const handleConfirmPurgeSingle = async () => {
    if (!nodeToPurge) return
    const { path, label } = nodeToPurge
    setActionLoadingKey(path)
    try {
      if (path.includes('conference_dashboards') || path.includes('latest_conference_dashboard')) {
        await clearConferenceDashboardHistory()
      }
      const res = await purgeSingleNode(path)
      await loadStats()
      onNotify?.(`Coluna "${label}" limpa com sucesso! ${res.freedBytes ? `${formatBytes(res.freedBytes)} liberados.` : ''}`, 'success')
      setNodeToPurge(null)
    } catch (err: any) {
      onNotify?.(`Erro ao limpar coluna: ${err?.message || 'Falha na exclusão.'}`, 'error')
    } finally {
      setActionLoadingKey(null)
    }
  }

  // Limpar Colunas Selecionadas
  const handlePurgeSelected = async () => {
    if (selectedColumns.length === 0) return
    setIsOptimizing(true)
    try {
      if (selectedColumns.some((p) => p.includes('conference_dashboards') || p.includes('latest_conference_dashboard'))) {
        await clearConferenceDashboardHistory()
      }
      const res = await purgeSelectedNodes(selectedColumns)
      await loadStats()
      setSelectedColumns([])
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao limpar colunas selecionadas: ${err?.message || 'Falha.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Limpeza de Todas as Colunas de Telemetria
  const handlePurgeAllColumns = async () => {
    setIsOptimizing(true)
    setIsBulkPurgeModalOpen(false)
    try {
      await clearConferenceDashboardHistory()
      const res = await purgeAllTelemetryColumns(preserveUsersInBulk)
      await loadStats()
      setSelectedColumns([])
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao limpar colunas: ${err?.message || 'Falha na exclusão.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Limpeza Total Raiz (com confirmação digitada)
  const handlePurgeAllTelemetryRoot = async () => {
    if (dangerConfirmText.trim().toUpperCase() !== 'LIMPAR') {
      onNotify?.('Digite exatamente "LIMPAR" para confirmar a exclusão.', 'warning')
      return
    }

    setIsOptimizing(true)
    setIsDangerModalOpen(false)
    setDangerConfirmText('')

    try {
      await clearConferenceDashboardHistory()
      const res = await purgeEntireVlicTelemetryRoot()
      await loadStats()
      setSelectedColumns([])
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao limpar telemetria: ${err?.message || 'Falha na exclusão.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Apagar todos os títulos e chaves residuais que continuam no banco
  const handlePurgeResidualKeys = async () => {
    setIsOptimizing(true)
    setIsPurgeResidualKeysModalOpen(false)
    try {
      await clearConferenceDashboardHistory()
      const res = await purgeAllResidualKeysAndTitles()
      await loadStats()
      setSelectedColumns([])
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao apagar títulos e chaves do banco: ${err?.message || 'Falha na exclusão.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Wipe Total do Banco Mantendo Exclusivamente Usuários (users) e Departamentos (user_departments)
  const handleWipeDatabasePreservingUsers = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'LIMPAR TUDO') {
      onNotify?.('Digite exatamente "LIMPAR TUDO" para confirmar a exclusão.', 'warning')
      return
    }

    setIsOptimizing(true)
    setIsWipeKeepUsersModalOpen(false)
    setWipeConfirmText('')

    try {
      await clearConferenceDashboardHistory()
      const res = await purgeDatabasePreservingOnlyUsersAndDepartments()
      await loadStats()
      setSelectedColumns([])
      onNotify?.(res.summary, 'success')
    } catch (err: any) {
      onNotify?.(`Erro ao limpar banco: ${err?.message || 'Falha na exclusão.'}`, 'error')
    } finally {
      setIsOptimizing(false)
    }
  }

  const toggleSelectColumn = (path: string) => {
    setSelectedColumns((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const totalBytes = stats.totalBytes || 0
  const quotaBytes = stats?.quotaBytes || 1024 * 1024 * 1024
  const pctUsed = stats ? Math.min(stats.percentageUsed, 100) : 0
  const freeBytes = Math.max(0, quotaBytes - totalBytes)

  // Status de Saúde
  const isHealthy = pctUsed < 30
  const isWarning = pctUsed >= 30 && pctUsed < 70
  const isCritical = pctUsed >= 70

  // Lista de colunas sob vlic_telemetry exibidas na imagem do usuário
  const telemetryColumnsList: {
    key: string
    path: string
    title: string
    icon: any
    color: string
    bgLight: string
    bgDark: string
    metric?: StorageNodeMetric
  }[] = [
    {
      key: 'conference_dashboards',
      path: 'vlic_telemetry/conference_dashboards',
      title: 'conference_dashboards',
      icon: Radio,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgLight: 'bg-emerald-100',
      bgDark: 'dark:bg-emerald-950',
      metric: stats.sections.conferenceDashboards || stats.sections.conference_dashboards,
    },
    {
      key: 'latest_conference_dashboard',
      path: 'vlic_telemetry/latest_conference_dashboard',
      title: 'latest_conference_dashboard',
      icon: Activity,
      color: 'text-teal-600 dark:text-teal-400',
      bgLight: 'bg-teal-100',
      bgDark: 'dark:bg-teal-950',
      metric: stats.sections.latestConferenceDashboard || stats.sections.latest_conference_dashboard,
    },
    {
      key: 'metrics',
      path: 'vlic_telemetry/metrics',
      title: 'metrics',
      icon: BarChart3,
      color: 'text-amber-600 dark:text-amber-400',
      bgLight: 'bg-amber-100',
      bgDark: 'dark:bg-amber-950',
      metric: stats.sections.metrics,
    },
    {
      key: 'presence',
      path: 'vlic_telemetry/presence',
      title: 'presence',
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bgLight: 'bg-purple-100',
      bgDark: 'dark:bg-purple-950',
      metric: stats.sections.presence,
    },
    {
      key: 'screens',
      path: 'vlic_telemetry/screens',
      title: 'screens',
      icon: Monitor,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgLight: 'bg-cyan-100',
      bgDark: 'dark:bg-cyan-950',
      metric: stats.sections.screens,
    },
    {
      key: 'suggestions',
      path: 'vlic_telemetry/suggestions',
      title: 'suggestions',
      icon: Lightbulb,
      color: 'text-amber-600 dark:text-amber-400',
      bgLight: 'bg-amber-100',
      bgDark: 'dark:bg-amber-950',
      metric: stats.sections.suggestions,
    },
    {
      key: 'input_files',
      path: 'vlic_telemetry/input_files',
      title: 'input_files',
      icon: FileSpreadsheet,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgLight: 'bg-indigo-100',
      bgDark: 'dark:bg-indigo-950',
      metric: stats.sections.inputFiles || stats.sections.input_files,
    },
    {
      key: 'activities',
      path: 'vlic_telemetry/activities',
      title: 'activities',
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgLight: 'bg-blue-100',
      bgDark: 'dark:bg-blue-950',
      metric: stats.sections.activities,
    },
  ]

  // Detecta colunas dinâmicas adicionais
  const extraColumns = Object.keys(stats.sections).filter((k) => {
    const isStandard = [
      'conferenceDashboards',
      'conference_dashboards',
      'latestConferenceDashboard',
      'latest_conference_dashboard',
      'metrics',
      'presence',
      'screens',
      'suggestions',
      'inputFiles',
      'input_files',
      'activities',
      'users',
      'cadastrosLogisticos',
      'cadastros_logisticos',
      'localStorage',
    ].includes(k)
    return !isStandard
  })

  const allPurgeablePaths = telemetryColumnsList.map((col) => col.path)

  const handleSelectAll = () => {
    if (selectedColumns.length === allPurgeablePaths.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns([...allPurgeablePaths])
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/40 border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <HardDrive className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              Gestão de Consumo & Limpeza das Colunas do Banco
            </h2>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Conectado ao Firebase Realtime Database:{' '}
            <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
              {stats.databaseUrl || 'https://conferente2-d10d9-default-rtdb.firebaseio.com'}
            </code>
            . Você pode <strong>limpar qualquer coluna individualmente</strong> ou <strong>limpar todas de uma vez</strong> para otimizar o banco.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isLoading && (
            <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 bg-emerald-100/90 dark:bg-emerald-950/80 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span>Sincronizando banco...</span>
            </span>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => setIsWipeKeepUsersModalOpen(true)}
            disabled={isOptimizing}
            className="text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white cursor-pointer shadow-xs flex items-center gap-1.5 h-9 px-3.5"
            title="Apaga todo o banco mantendo exclusivamente os nós de usuários (users) e departamentos (user_departments)"
          >
            <Trash2 className="h-4 w-4" />
            Apagar Banco (Manter Usuários)
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsPurgeResidualKeysModalOpen(true)}
            disabled={isOptimizing}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5 h-9 px-3.5"
            title="Remove os títulos e chaves residuais que continuam no banco de dados"
          >
            <Trash2 className="h-4 w-4" />
            Apagar Títulos e Chaves Residuais
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsBulkPurgeModalOpen(true)}
            disabled={isOptimizing}
            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5 h-9 px-3.5"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Todas as Colunas
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSmartOptimization}
            disabled={isOptimizing}
            className="text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5 h-9 px-3.5"
          >
            {isOptimizing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 text-amber-300" />
            )}
            {isOptimizing ? 'Otimizando...' : 'Otimizar Banco'}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadStats}
            disabled={isLoading}
            className="text-xs h-9 px-2.5 cursor-pointer text-zinc-600 dark:text-zinc-300"
            title="Recalcular Métricas"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* PAINEL PRINCIPAL DE INDICADORES DE ARMAZENAMENTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Consumo Atual vs Cota Spark */}
        <Card className="md:col-span-2 shadow-xs border border-zinc-200 dark:border-zinc-800">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
                <Database className="h-4 w-4 text-emerald-600" />
                <span>Armazenamento em Nuvem (Firebase RTDB • vlic_telemetry)</span>
              </CardTitle>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                stats?.isOnline
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
                {stats?.isOnline ? 'Online • Conectado ao Firebase' : 'Modo Offline / Local'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                  {formatBytes(totalBytes)}
                </span>
                <span className="text-xs text-zinc-400">
                  em uso de <strong>{formatBytes(quotaBytes)}</strong> (Cota Gratuita Spark)
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {pctUsed < 0.01 ? '< 0.01%' : `${pctUsed.toFixed(2)}%`} ocupado
              </span>
            </div>

            {/* Barra de Progresso do Armazenamento */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCritical
                    ? 'bg-rose-500'
                    : isWarning
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                }`}
                style={{ width: `${Math.max(pctUsed, 0.8)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <span>
                Espaço Livre Restante: <strong>{formatBytes(freeBytes)}</strong>
              </span>
              <span>
                Total de Registros: <strong>{stats?.totalItems.toLocaleString('pt-BR')}</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Diagnóstico de Saúde e Recomendação */}
        <Card className="shadow-xs border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-600" />
              <span>Status do Banco</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 flex-1 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {isHealthy ? 'Banco Otimizado & Veloz' : isWarning ? 'Atenção aos Logs' : 'Otimização Urgente'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Você pode apagar arquivos de cada coluna individualmente clicando em <strong>Limpar Coluna</strong>, ou selecionar múltiplas colunas para limpar tudo de uma vez.
              </p>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[10px] text-zinc-400">
                Última checagem: {new Date(stats?.updatedAt || Date.now()).toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PAINEL DE ESTRATÉGIA DE REDUÇÃO DE GASTOS & MODO ECONÔMICO AUTOMÁTICO */}
      <Card className="shadow-xs border-2 border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 dark:from-emerald-950/20 dark:via-zinc-900/60 dark:to-teal-950/20 overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-emerald-100 dark:border-emerald-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Estratégia de Redução de Gastos & Modo Econômico
                  </CardTitle>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Custo Zero Recomendado
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Plano Spark: 1 GB Grátis
                  </span>
                </div>
                <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Controle a retenção e elimine o acúmulo desnecessário de dados no Firebase Realtime Database.
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleApplyEconomyNow}
              disabled={isApplyingEconomy}
              className="text-xs h-9 font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs shrink-0 flex items-center gap-2"
            >
              <Sparkles className={`h-4 w-4 ${isApplyingEconomy ? 'animate-spin' : ''}`} />
              {isApplyingEconomy ? 'Aplicando Redução...' : 'Ativar Modo Econômico Agora'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-4 space-y-4">
          {/* Seletor de Modo Econômico */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-emerald-600" />
              <span>Selecione a Política de Armazenamento:</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opção 1: Extremo */}
              <div
                onClick={() => handleUpdateEconomyMode('extreme')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  economySettings.economyMode === 'extreme'
                    ? 'border-emerald-500 bg-emerald-100/40 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Modo Extremo (Recomendado)
                    </span>
                  </div>
                  {economySettings.economyMode === 'extreme' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  <strong>Custo Zero & Máxima Velocidade:</strong> Mantém apenas 1 espelho ao vivo no Firebase. Histórico de conferências fica no computador local. Limita arquivos e atividades a 30 itens com expurgo automático. Reduz em até 98% o consumo de banco e banda.
                </p>
              </div>

              {/* Opção 2: Padrão */}
              <div
                onClick={() => handleUpdateEconomyMode('standard')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  economySettings.economyMode === 'standard'
                    ? 'border-emerald-500 bg-emerald-100/40 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Modo Otimizado Balanceado
                    </span>
                  </div>
                  {economySettings.economyMode === 'standard' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Mantém até 3 espelhos históricos em versão compacta (sem replicar listas brutas de notas). Histórico de arquivos e atividades limitado a 100 itens.
                </p>
              </div>

              {/* Opção 3: Personalizado */}
              <div
                onClick={() => handleUpdateEconomyMode('custom')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  economySettings.economyMode === 'custom'
                    ? 'border-emerald-500 bg-emerald-100/40 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Modo Personalizado
                    </span>
                  </div>
                  {economySettings.economyMode === 'custom' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Permite definir limites customizados de retenção por nó do Firebase de acordo com a política da sua empresa.
                </p>
              </div>
            </div>
          </div>

          {/* Seção Explicativa Colapsável */}
          <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
            <button
              type="button"
              onClick={() => setShowEconomyDetails(!showEconomyDetails)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 py-1 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>O que podemos fazer para reduzir os gastos de banco de dados? (Clique para ver as 5 medidas)</span>
              </div>
              {showEconomyDetails ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>

            {showEconomyDetails && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-zinc-600 dark:text-zinc-400 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                <div className="space-y-1.5">
                  <h5 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
                    Como o Firebase cobra
                  </h5>
                  <p className="leading-relaxed">
                    O Firebase cobra por <strong>espaço armazenado</strong> (acima de 1 GB no plano gratuito) e por <strong>download de dados/banda</strong> (acima de 10 GB/mês). Cada vez que uma tela é aberta, ela baixa os dados dos nós subscritos.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h5 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
                    O maior vilão: conference_dashboards
                  </h5>
                  <p className="leading-relaxed">
                    Cada conferência salva na íntegra relatórios com centenas de notas fiscais. O <strong>Modo Extremo</strong> desativa o acúmulo infinito de cópias na nuvem, mantendo apenas 1 espelho ativo e salvando históricos localmente.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h5 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">3</span>
                    Expurgo Automático (Rotatividade)
                  </h5>
                  <p className="leading-relaxed">
                    Arquivos de entrada (<code>input_files</code>) e atividades (<code>activities</code>) agora têm expurgo automático em segundo plano, mantendo apenas os últimos registros e deletando dados antigos sem intervenção manual.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h5 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px]">4</span>
                    Economia de Banda (Queries Limitadas)
                  </h5>
                  <p className="leading-relaxed">
                    Todas as escutas do Firebase agora usam <code>limitToLast(60)</code>. O navegador nunca baixa a árvore inteira de uma só vez, economizando gigabytes de cota de transferência e acelerando o carregamento.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DESTAQUE RÁPIDO PARA A COLUNA: conference_dashboards (SEMPRE VISÍVEL) */}
      <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-xs">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-rose-950 dark:text-rose-100 flex items-center gap-2">
              <span>Coluna de Espelhos:</span>
              <code className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">
                vlic_telemetry/conference_dashboards
              </code>
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                ({(stats.sections.conferenceDashboards?.count || stats.sections.conference_dashboards?.count || 0).toLocaleString('pt-BR')} registros • {formatBytes(stats.sections.conferenceDashboards?.bytes || stats.sections.conference_dashboards?.bytes || 0)})
              </span>
            </h4>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
              Esta coluna contém todos os espelhos e snapshots gerados no seu Firebase Realtime Database. Clique ao lado para apagar permanentemente e zerar esta pasta no banco.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() =>
            setNodeToPurge({
              path: 'vlic_telemetry/conference_dashboards',
              label: 'conference_dashboards',
              count: stats.sections.conferenceDashboards?.count || stats.sections.conference_dashboards?.count || 0,
              bytes: stats.sections.conferenceDashboards?.bytes || stats.sections.conference_dashboards?.bytes || 0,
            })
          }
          className="text-xs h-8.5 font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir Todos os Espelhos Agora
        </Button>
      </div>

      {/* BARRA DE AÇÕES EM LOTE DE COLUNAS */}
      <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSelectAll}
            className="text-xs h-8 cursor-pointer text-zinc-700 dark:text-zinc-300"
          >
            {selectedColumns.length === allPurgeablePaths.length ? (
              <>
                <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                Desmarcar Todas
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5 mr-1.5" />
                Selecionar Todas ({allPurgeablePaths.length})
              </>
            )}
          </Button>

          {selectedColumns.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handlePurgeSelected}
              disabled={isOptimizing}
              className="text-xs h-8 font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Limpar {selectedColumns.length} Coluna(s) Selecionada(s)
            </Button>
          )}

          <span className="text-xs text-zinc-500 hidden sm:inline">
            {selectedColumns.length === 0
              ? 'Selecione colunas pelas caixas de seleção abaixo para limpar em lote'
              : `${selectedColumns.length} de ${allPurgeablePaths.length} colunas marcadas para exclusão`}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsBulkPurgeModalOpen(true)}
          className="text-xs h-8 font-bold border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Limpar Todas as Colunas de Telemetria
        </Button>
      </div>

      {/* SEÇÕES DETALHADAS DAS COLUNAS DO BANCO (vlic_telemetry) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-zinc-500" />
            <span>Colunas do Banco de Dados (vlic_telemetry)</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setHideEmptyColumns(!hideEmptyColumns)}
              className="text-[11px] h-7 px-2.5 font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              {hideEmptyColumns ? 'Exibir Todas as Chaves' : 'Ocultar Chaves Vazias/Apagadas'}
            </Button>
            <span className="text-[11px] text-zinc-400 hidden lg:inline">
              Cada coluna pode ser esvaziada individualmente ou em lote
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {telemetryColumnsList.map((col) => {
            const Icon = col.icon
            const metric = col.metric
            const count = metric?.count || 0
            const bytes = metric?.bytes || 0
            const isSelected = selectedColumns.includes(col.path)
            const isCurrentActionLoading = actionLoadingKey === col.path
            const isEmpty = count === 0 && bytes === 0

            if (hideEmptyColumns && isEmpty) return null

            return (
              <div
                key={col.path}
                className={`p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-rose-400 dark:border-rose-700 bg-rose-50/20 dark:bg-rose-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs'
                } space-y-3`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Checkbox de seleção */}
                    <button
                      type="button"
                      onClick={() => toggleSelectColumn(col.path)}
                      className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer transition-colors border ${
                        isSelected
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-800'
                      }`}
                      title={isSelected ? 'Desmarcar' : 'Selecionar para limpeza'}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>

                    <div className={`p-2 rounded-lg ${col.bgLight} ${col.bgDark} ${col.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {col.title}
                        </code>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          ({col.path})
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                        {metric?.description || `Coluna ${col.title} no Firebase Realtime Database.`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                      {formatBytes(bytes)}
                    </span>
                    <span className="text-[10px] text-zinc-400 block">
                      {count} {count === 1 ? 'registro' : 'registros'}
                    </span>
                    {isEmpty && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Chave Vazia / Apagada
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Botões específicos para espelhos */}
                  {col.key === 'conference_dashboards' && count > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          'conf-5',
                          () => purgeConferenceHistory(5),
                          'Histórico compactado: mantidos os 5 espelhos mais recentes'
                        )
                      }
                      disabled={actionLoadingKey === 'conf-5' || count <= 5}
                      className="text-[11px] h-7 px-2 cursor-pointer text-zinc-700 dark:text-zinc-300"
                    >
                      Manter últimos 5
                    </Button>
                  )}

                  {/* Botões específicos para arquivos */}
                  {col.key === 'input_files' && count > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleAction(
                          'files-50',
                          () => purgeInputFiles(50),
                          'Arquivos compactados: mantidos os 50 mais recentes'
                        )
                      }
                      disabled={actionLoadingKey === 'files-50' || count <= 50}
                      className="text-[11px] h-7 px-2 cursor-pointer text-zinc-700 dark:text-zinc-300"
                    >
                      Manter últimos 50
                    </Button>
                  )}

                  {/* Botão Direto de Limpar Esta Coluna / Excluir Chave do Banco */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setNodeToPurge({
                        path: col.path,
                        label: col.title,
                        count,
                        bytes,
                      })
                    }
                    disabled={isCurrentActionLoading}
                    className="text-[11px] h-7 px-2.5 font-bold cursor-pointer text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title={isEmpty ? "Remove permanentemente este título e chave do Firebase" : "Limpa todos os dados armazenados nesta coluna"}
                  >
                    {isCurrentActionLoading ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    {isEmpty ? 'Excluir Chave do Banco' : 'Limpar Coluna'}
                  </Button>
                </div>
              </div>
            )
          })}

          {/* Colunas Extras Dinâmicas caso existam */}
          {extraColumns.map((k) => {
            const metric = stats.sections[k]
            if (!metric) return null
            const isSelected = selectedColumns.includes(metric.path)

            return (
              <div
                key={metric.path}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectColumn(metric.path)}
                      className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer border ${
                        isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </button>
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <code className="text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {metric.label}
                      </code>
                      <p className="text-[11px] text-zinc-400">{metric.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold block">{formatBytes(metric.bytes)}</span>
                    <span className="text-[10px] text-zinc-400">{metric.count} itens</span>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setNodeToPurge({
                        path: metric.path,
                        label: metric.label,
                        count: metric.count,
                        bytes: metric.bytes,
                      })
                    }
                    className="text-[11px] h-7 px-2.5 font-bold text-rose-600 border-rose-200"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar Coluna
                  </Button>
                </div>
              </div>
            )
          })}

          {/* Cache Local do Navegador */}
          {stats.sections.localStorage && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Cache Local do Navegador (LocalStorage)
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Cópias em cache de arquivos e atividades offline armazenadas no navegador.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    {formatBytes(stats.sections.localStorage.bytes)}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {stats.sections.localStorage.count} chaves locais
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const res = clearBrowserLocalStorage()
                    loadStats()
                    onNotify?.(`Cache local limpo (${formatBytes(res.freedBytes)} liberados)`, 'success')
                  }}
                  disabled={stats.sections.localStorage.bytes === 0}
                  className="text-[11px] h-7 px-2.5 cursor-pointer text-zinc-600 dark:text-zinc-300"
                >
                  Limpar Cache Local
                </Button>
              </div>
            </div>
          )}

          {/* Seções Protegidas (Cadastros & Usuários) */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Cadastros Logísticos & Usuários (Protegidos)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Preservados
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Os destinatários, CNPJs, transbordos cadastrados na aba Monitor e os perfis de operadores são preservados para não interromper a operação.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-zinc-600 dark:text-zinc-400 pt-1 font-mono">
              <span>Cadastros: <strong>{formatBytes(stats?.sections?.cadastrosLogisticos?.bytes || 0)}</strong></span>
              <span>Usuários: <strong>{formatBytes(stats?.sections?.users?.bytes || 0)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ZONA DE PERIGO: WIPE TOTAL PRESERVANDO APENAS USERS E USER_DEPARTMENTS */}
      <Card className="border border-purple-200 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/15 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold text-xs">
              <Trash2 className="h-4 w-4 text-purple-600" />
              <span>Apagar Todo o Banco de Dados (Mantendo Exclusivamente users e user_departments)</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xl">
              Exclui completamente todos os espelhos, conferências, atividades, métricas, presenças, arquivos inputados e dados externos no Firebase. 
              <strong> Os nós de Usuários (<code>users</code>) e Departamentos (<code>user_departments</code>) permanecem 100% preservados e intactos.</strong>
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsWipeKeepUsersModalOpen(true)}
            className="text-xs h-8 px-3 font-bold bg-purple-700 hover:bg-purple-800 text-white cursor-pointer shrink-0 shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-white" />
            Wipe (Manter Usuários)
          </Button>
        </CardContent>
      </Card>

      {/* ZONA DE PERIGO: LIMPEZA COMPLETA DE TELEMETRIA */}
      <Card className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/15 dark:bg-rose-950/10 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Reset Total da Raiz vlic_telemetry (Limpeza Completa)</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xl">
              Remove a árvore inteira <code>vlic_telemetry</code> do Firebase Realtime Database. Recomendado caso deseje iniciar o sistema do zero mantendo apenas os cadastros de destinatários/transbordos.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsDangerModalOpen(true)}
            className="text-xs h-8 px-3 font-bold border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
            Reset Completo da Raiz
          </Button>
        </CardContent>
      </Card>

      {/* GUIA DE REGRAS DO FIREBASE REALTIME DATABASE */}
      <Card className="border border-blue-200 dark:border-blue-900/60 bg-blue-50/15 dark:bg-blue-950/10 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold text-xs">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>Regras de Permissão do Firebase Realtime Database (Correção de permission_denied)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg bg-zinc-200/80 dark:bg-zinc-800 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setRulesTab('rbac')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    rulesTab === 'rbac'
                      ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Supervisor & Colaborador (RBAC)
                </button>
                <button
                  type="button"
                  onClick={() => setRulesTab('open')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    rulesTab === 'open'
                      ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  Regras Abertas (Simplificadas)
                </button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const rbacRulesText = `{
  "rules": {
    "usuarios": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && (auth.uid == $uid || root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
      }
    },
    "vlic_telemetry": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'thiago.viaembratelgja@gmail.com' || auth.token.email == 'admin@tegporto.com.br')",
      "users": {
        ".read": "auth != null",
        "$uid": {
          ".write": "auth != null && (auth.uid == $uid || root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
        }
      },
      "user_departments": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
      },
      "$subnode": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br' || !data.exists())",
        "$item": {
          ".read": "auth != null",
          ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br' || !data.exists())"
        }
      }
    },
    "dados": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')",
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br' || !data.exists())"
      }
    },
    "cadastros_logisticos": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "rumo_files": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}`

                  const openRulesText = `{
  "rules": {
    "vlic_telemetry": {
      ".read": true,
      ".write": true
    },
    "dados": {
      ".read": true,
      ".write": true
    },
    "usuarios": {
      ".read": true,
      ".write": true
    },
    "cadastros_logisticos": {
      ".read": true,
      ".write": true
    },
    "rumo_files": {
      ".read": true,
      ".write": true
    }
  }
}`

                  const targetText = rulesTab === 'rbac' ? rbacRulesText : openRulesText
                  navigator.clipboard.writeText(targetText)
                  setCopiedRules(true)
                  setTimeout(() => setCopiedRules(false), 3000)
                  onNotify?.('Regras copiadas! Cole no Firebase Console > Realtime Database > Regras (Rules).', 'success')
                }}
                className="text-xs h-7 px-2.5 font-bold border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer shrink-0"
              >
                {copiedRules ? <Check className="h-3 w-3 mr-1 text-emerald-600" /> : <Copy className="h-3 w-3 mr-1" />}
                {copiedRules ? 'Regras Copiadas!' : 'Copiar Regras do Firebase'}
              </Button>
            </div>
          </div>

          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 leading-relaxed">
            <p>
              <strong>Por que o Supervisor era bloqueado na exclusão e restavam as chaves/títulos?</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li>
                <strong>Caminho <code className="text-rose-600 font-mono">vlic_telemetry</code> ausente nas regras:</strong> O Firebase Realtime Database bloqueia por padrão qualquer nó não declarado. Como a sua regra anterior continha apenas o nó <code className="font-mono text-zinc-800 dark:text-zinc-200">"dados"</code>, todas as operações sob <code className="font-mono text-zinc-800 dark:text-zinc-200">vlic_telemetry</code> (espelhos, atividades, presenças, arquivos inputados) geravam <code className="text-rose-600 font-mono">permission_denied</code>.
              </li>
              <li>
                <strong>Regra <code className="font-mono text-zinc-800 dark:text-zinc-200">.write</code> apenas no filho <code className="font-mono text-zinc-800 dark:text-zinc-200">$id</code>:</strong> No Firebase, permissão em nós filhos não autoriza apagar ou sobrescrever a pasta pai. Para que o supervisor consiga apagar uma chave inteira (como <code className="font-mono text-zinc-800 dark:text-zinc-200">conference_dashboards</code> ou o nó raiz), a permissão de <code className="font-mono text-zinc-800 dark:text-zinc-200">.write</code> precisa estar declarada também no nível do nó pai.
              </li>
              <li>
                <strong>Com as regras abaixo:</strong> O <strong>supervisor tem permissão total irrestrita</strong> de leitura, modificação e <strong>exclusão completa de nós e chaves</strong>, enquanto o <strong>colaborador só pode inserir novos dados</strong> (<code className="font-mono text-emerald-600">!data.exists()</code>), ficando impedido de excluir ou sobrescrever.
              </li>
            </ul>
          </div>

          <pre className="p-3 rounded-lg bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-zinc-800 max-h-72">
{rulesTab === 'rbac'
  ? `{
  "rules": {
    "usuarios": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && (auth.uid == $uid || root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
      }
    },
    "vlic_telemetry": {
      ".read": "auth != null",
      ".write": "auth != null && (
        root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' ||
        root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' ||
        root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' ||
        root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' ||
        auth.token.email == 'thiago_gja27@hotmail.com' ||
        auth.token.email == 'thiago.gja27@hotmail.com' ||
        auth.token.email == 'thiago.viaembratelgja@gmail.com' ||
        auth.token.email == 'admin@tegporto.com.br'
      )",
      "users": {
        ".read": "auth != null",
        "$uid": {
          ".write": "auth != null && (auth.uid == $uid || root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
        }
      },
      "user_departments": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' || root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' || auth.token.email == 'thiago_gja27@hotmail.com' || auth.token.email == 'thiago.gja27@hotmail.com' || auth.token.email == 'admin@tegporto.com.br')"
      },
      "$subnode": {
        ".read": "auth != null",
        ".write": "auth != null && (
          root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' ||
          root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' ||
          root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' ||
          root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' ||
          auth.token.email == 'thiago_gja27@hotmail.com' ||
          auth.token.email == 'thiago.gja27@hotmail.com' ||
          auth.token.email == 'admin@tegporto.com.br' ||
          !data.exists()
        )",
        "$item": {
          ".read": "auth != null",
          ".write": "auth != null && (
            root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' ||
            root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' ||
            root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' ||
            root.child('usuarios').child(auth.uid).child('departamento').val() == 'supervisor' ||
            auth.token.email == 'thiago_gja27@hotmail.com' ||
            auth.token.email == 'thiago.gja27@hotmail.com' ||
            auth.token.email == 'admin@tegporto.com.br' ||
            !data.exists()
          )"
        }
      }
    },
    "dados": {
      ".read": "auth != null",
      ".write": "auth != null && (
        root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' ||
        root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' ||
        root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' ||
        auth.token.email == 'thiago_gja27@hotmail.com' ||
        auth.token.email == 'admin@tegporto.com.br'
      )",
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null && (
          root.child('vlic_telemetry').child('users').child(auth.uid).child('departamento').val() == 'supervisor' ||
          root.child('vlic_telemetry').child('users').child(auth.uid).child('role').val() == 'supervisor' ||
          root.child('usuarios').child(auth.uid).child('role').val() == 'supervisor' ||
          auth.token.email == 'thiago_gja27@hotmail.com' ||
          auth.token.email == 'admin@tegporto.com.br' ||
          !data.exists()
        )"
      }
    },
    "cadastros_logisticos": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "rumo_files": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}`
  : `{
  "rules": {
    "vlic_telemetry": {
      ".read": true,
      ".write": true
    },
    "dados": {
      ".read": true,
      ".write": true
    },
    "usuarios": {
      ".read": true,
      ".write": true
    },
    "cadastros_logisticos": {
      ".read": true,
      ".write": true
    },
    "rumo_files": {
      ".read": true,
      ".write": true
    }
  }
}`}
          </pre>
        </CardContent>
      </Card>

      {/* MODAL 1: CONFIRMAÇÃO DE LIMPEZA DE UMA COLUNA ESPECÍFICA */}
      <Dialog open={!!nodeToPurge} onOpenChange={(open) => !open && setNodeToPurge(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" />
              Limpar Coluna do Banco
            </DialogTitle>
            <DialogDescription className="text-xs">
              Você está prestes a apagar todos os dados armazenados na coluna:
            </DialogDescription>
          </DialogHeader>

          {nodeToPurge && (
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Coluna:</span>
                <strong className="text-zinc-900 dark:text-zinc-100">{nodeToPurge.path}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tamanho Atual:</span>
                <strong className="text-rose-600">{formatBytes(nodeToPurge.bytes)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total de Registros:</span>
                <strong>{nodeToPurge.count}</strong>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNodeToPurge(null)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmPurgeSingle}
              disabled={!!actionLoadingKey}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {actionLoadingKey ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Confirmar e Apagar Coluna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONFIRMAÇÃO DE LIMPEZA DE TODAS AS COLUNAS */}
      <Dialog open={isBulkPurgeModalOpen} onOpenChange={setIsBulkPurgeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Limpar Todas as Colunas de Telemetria
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação esvaziará todas as seguintes colunas do Firebase Realtime Database:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 space-y-1 text-xs">
            {telemetryColumnsList.map((col) => (
              <div key={col.path} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-600 dark:text-zinc-400">• {col.path}</span>
                <span className="text-zinc-500">{formatBytes(col.metric?.bytes || 0)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="preserveUsersCheck"
              checked={preserveUsersInBulk}
              onChange={(e) => setPreserveUsersInBulk(e.target.checked)}
              className="rounded text-emerald-600 cursor-pointer h-4 w-4"
            />
            <label htmlFor="preserveUsersCheck" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Preservar Usuários & Departamentos (recomendado)
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkPurgeModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePurgeAllColumns}
              disabled={isOptimizing}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {isOptimizing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Limpar Todas as Colunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: CONFIRMAÇÃO DE RESET TOTAL RAIZ (DIGITADO) */}
      <Dialog open={isDangerModalOpen} onOpenChange={setIsDangerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Reset Completo de vlic_telemetry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação removerá completamente o nó raiz <code>vlic_telemetry</code> no Firebase.
              <strong> Cadastros de destinatários e transbordos NÃO serão afetados.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Para confirmar, digite <strong className="text-rose-600 font-mono">LIMPAR</strong> no campo abaixo:
            </p>
            <Input
              value={dangerConfirmText}
              onChange={(e) => setDangerConfirmText(e.target.value)}
              placeholder="Digite LIMPAR"
              className="text-xs uppercase font-mono font-bold"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDangerModalOpen(false)
                setDangerConfirmText('')
              }}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={dangerConfirmText.trim().toUpperCase() !== 'LIMPAR'}
              onClick={handlePurgeAllTelemetryRoot}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              Confirmar e Limpar Banco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CONFIRMAÇÃO DE APAGAR TÍTULOS E CHAVES RESIDUAIS DO BANCO */}
      <Dialog open={isPurgeResidualKeysModalOpen} onOpenChange={setIsPurgeResidualKeysModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Trash2 className="h-5 w-5" />
              Apagar Títulos e Chaves Residuais do Banco
            </DialogTitle>
            <DialogDescription className="text-xs">
              Remoção profunda de todos os títulos, chaves e nós que continuam no Firebase Realtime Database após a exclusão anterior de dados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
            <p>
              Esta ação executará uma limpeza completa no <strong>Firebase Realtime Database</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>Exclui os títulos e chaves de espelhos (<code>conference_dashboards</code> e <code>latest_conference_dashboard</code>)</li>
              <li>Exclui a pasta de arquivos inputados (<code>input_files</code>)</li>
              <li>Exclui métricas, atividades, presenças e telas residuais (<code>metrics</code>, <code>activities</code>, <code>presence</code>, <code>screens</code>, <code>suggestions</code>)</li>
              <li>Remove o nó raiz <code>vlic_telemetry</code> via REST e SDK, garantindo que nenhuma chave vazia permaneça</li>
            </ul>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              ✓ Seus cadastros de destinatários e transbordos continuarão 100% preservados.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPurgeResidualKeysModalOpen(false)}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePurgeResidualKeys}
              disabled={isOptimizing}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              {isOptimizing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Sim, Apagar Todos os Títulos e Chaves Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: CONFIRMAÇÃO DE WIPE TOTAL (PRESERVANDO EXCLUSIVAMENTE USERS E USER_DEPARTMENTS) */}
      <Dialog open={isWipeKeepUsersModalOpen} onOpenChange={setIsWipeKeepUsersModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Trash2 className="h-5 w-5" />
              Apagar Todo o Banco (Preservando Apenas Usuários)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Limpeza profunda de todo o banco de dados Firebase Realtime, mantendo intactos exclusivamente os usuários e departamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                O que SERÁ PRESERVADO:
              </p>
              <ul className="list-disc pl-5 text-[11px] text-emerald-700 dark:text-emerald-300 space-y-0.5">
                <li><strong>vlic_telemetry/users</strong> (perfis e cargos de operadores/supervisores)</li>
                <li><strong>vlic_telemetry/user_departments</strong> (departamentos por e-mail)</li>
              </ul>
            </div>

            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-1">
              <p className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                O que SERÁ TOTALMENTE APAGADO:
              </p>
              <ul className="list-disc pl-5 text-[11px] text-rose-700 dark:text-rose-400 space-y-0.5">
                <li>Todos os espelhos de conferência (<code>conference_dashboards</code>)</li>
                <li>Histórico de arquivos inputados (<code>input_files</code>)</li>
                <li>Métricas, atividades da linha do tempo e telas (<code>metrics</code>, <code>activities</code>, <code>screens</code>)</li>
                <li>Presenças e sugestões (<code>presence</code>, <code>suggestions</code>)</li>
                <li>Tabelas adicionais (ex: <code>dados</code>, <code>rumo_files</code>, etc.)</li>
              </ul>
            </div>

            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Para confirmar a exclusão, digite <strong className="text-purple-700 dark:text-purple-400 font-mono">LIMPAR TUDO</strong>:
              </p>
              <Input
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="Digite LIMPAR TUDO"
                className="text-xs uppercase font-mono font-bold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsWipeKeepUsersModalOpen(false)
                setWipeConfirmText('')
              }}
              className="text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={wipeConfirmText.trim().toUpperCase() !== 'LIMPAR TUDO' || isOptimizing}
              onClick={handleWipeDatabasePreservingUsers}
              className="text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
            >
              {isOptimizing ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Confirmar e Apagar Todo o Banco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
