import { useCallback, useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import TopDashboard from './TopDashboard';
import SidePanel from './SidePanel';
import FooterLogs from './FooterLogs';
import ExcelPreview from './ExcelPreview';
import OnboardingTour from './OnboardingTour';
import SuccessModal from './SuccessModal';
import SettingsModal from './SettingsModal';
import { validateBudget } from '../utils/budgetValidator';
import { usePlanifyStore } from '../store/usePlanifyStore';

export default function MainLayout() {
  const {
    tableData,
    formData,
    excelReadStatus,
    logs,
    progress,
    isProcessing,
    statusMessage,
    generationResult,
    wsConnected,
    configData,
    fetchProfiles,
    generateBudget,
    clearFormData,
    openOutputFolder,
    sendWhatsApp,
    setProgress,
    setWsConnected,
    appendLog,
    handleTaskEvent,
  } = usePlanifyStore();

  const [pendingWarnings, setPendingWarnings] = useState([]);
  const [tourReplayKey, setTourReplayKey] = useState(0);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dismissedSuccessKey, setDismissedSuccessKey] = useState('');
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempt = useRef(0);
  const hasLoggedWsOffline = useRef(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = import.meta.env.DEV
        ? 'ws://localhost:8000/ws/logs'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/logs`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setWsConnected(true);
        reconnectAttempt.current = 0;
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

        if (hasLoggedWsOffline.current) {
          appendLog('Conexão em tempo real restabelecida.', 'SUCCESS');
          hasLoggedWsOffline.current = false;
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'progress') {
            setProgress(data.value);
            return;
          }

          if (data.type === 'task') {
            handleTaskEvent(data);
            return;
          }

          if (data.type === 'log') {
            appendLog(data.message, data.level);
          }
        } catch {
          appendLog('Mensagem inválida recebida do servidor.', 'ERROR');
        }
      };

      ws.current.onclose = () => {
        setWsConnected(false);
        if (!hasLoggedWsOffline.current) {
          appendLog('Conexão com servidor perdida. Tentando reconectar em segundo plano...', 'ERROR');
          hasLoggedWsOffline.current = true;
        }

        const delayMs = Math.min(30000, 1000 * 2 ** reconnectAttempt.current);
        reconnectAttempt.current += 1;
        reconnectTimeout.current = setTimeout(connectWebSocket, delayMs);
      };

      ws.current.onerror = () => {
        if (!hasLoggedWsOffline.current) {
          appendLog('Erro na conexão em tempo real com o servidor. Tentando reconectar...', 'ERROR');
          hasLoggedWsOffline.current = true;
        }
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [appendLog, handleTaskEvent, setProgress, setWsConnected]);

  const runGenerationWithValidation = useCallback(() => {
    if (pendingWarnings.length > 0) return;

    const validation = validateBudget(formData, configData, tableData);

    if (!validation.isValid) {
      const hasModelOrBdiError = validation.errors.some((error) => ['perfil_id', 'bdi'].includes(error.field));
      const hasTableError = validation.errors.some((error) => error.field === 'tableData');
      const message = hasModelOrBdiError
        ? '⚠️ Escolha um Modelo e BDI antes de gerar!'
        : hasTableError
          ? 'Nenhum dado do Orçafascio foi carregado.'
          : validation.errors[0]?.message || 'Revise os campos obrigatórios antes de gerar.';

      toast.error(message);
      validation.errors.forEach((error) => appendLog(error.message, 'ERROR'));
      return;
    }

    if (validation.hasWarnings) {
      setPendingWarnings(validation.warnings);
      return;
    }

    generateBudget();
  }, [appendLog, configData, formData, generateBudget, pendingWarnings.length, tableData]);

  const confirmGenerationWithWarnings = () => {
    setPendingWarnings([]);
    generateBudget();
  };

  const startTour = useCallback(() => {
    setTourReplayKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const handleGlobalShortcuts = (event) => {
      const hasModifier = event.ctrlKey || event.metaKey;
      if (!hasModifier) return;

      const key = event.key.toLowerCase();

      if (key === 'enter') {
        event.preventDefault();
        runGenerationWithValidation();
        return;
      }

      if (key === 'l') {
        event.preventDefault();
        clearFormData();
        setPendingWarnings([]);
        appendLog('Formulário limpo pelo atalho Ctrl + L.', 'INFO');
        toast.success('Formulário limpo.');
        return;
      }

      if (event.ctrlKey && !event.metaKey && key === 'h') {
        event.preventDefault();
        startTour();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [appendLog, clearFormData, runGenerationWithValidation, startTour]);

  const canClickGenerate = excelReadStatus !== 'loading' && !isProcessing;
  const missingCritical = !tableData.length || !configData.perfil_id || !String(configData.bdi || '').trim();
  const successKey = generationResult?.caminho_excel || generationResult?.task_id || generationResult?.mensagem || '';
  const isSuccessOpen = Boolean(generationResult && dismissedSuccessKey !== successKey);

  return (
    <div className="min-h-screen bg-[#0E0E0E] font-sans text-gray-100">
      <OnboardingTour replayKey={tourReplayKey} />

      <Toaster
        position="top-center"
        containerClassName="fixed top-0 left-0 w-full z-[9999] pointer-events-none"
        containerStyle={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
        toastOptions={{
          duration: 4500,
          className: 'pointer-events-auto',
          style: {
            background: '#111827',
            color: '#F9FAFB',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            borderRadius: '12px',
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#111827',
            },
          },
        }}
      />

      {pendingWarnings.length > 0 && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-yellow-500/30 bg-[#171717] p-6 shadow-2xl shadow-black/50">
            <h3 className="text-base font-bold text-gray-100">Existem campos suspeitos</h3>
            <p className="mt-1 text-sm text-gray-400">Faltam preencher alguns campos. Deseja gerar assim mesmo?</p>

            <ul className="mt-5 space-y-2">
              {pendingWarnings.map((warning) => (
                <li key={`${warning.field}-${warning.message}`} className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
                  {warning.message}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingWarnings([])}
                className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-700"
              >
                Revisar
              </button>
              <button
                type="button"
                onClick={confirmGenerationWithWarnings}
                className="rounded-xl bg-gradient-to-r from-[#E67E22] to-[#D35400] px-4 py-2 text-sm font-bold text-white shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Gerar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      {isLogsOpen && (
        <div className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm" onClick={() => setIsLogsOpen(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-gray-800 bg-[#101010] p-5 pb-20 shadow-2xl animate-slide-in-right custom-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-gray-100">Console de Logs</h2>
                <p className="mt-1 text-xs text-gray-500">Diagnóstico sob demanda. A tela principal fica limpa.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLogsOpen(false)}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
            <FooterLogs logs={logs} progress={progress} />
          </aside>
        </div>
      )}

      <SuccessModal
        isOpen={isSuccessOpen}
        result={generationResult}
        onClose={() => setDismissedSuccessKey(successKey)}
        onOpenFolder={async () => {
          try {
            await openOutputFolder();
          } catch {
            toast.error('Não foi possível abrir a pasta do arquivo.');
          }
        }}
        onWhatsApp={sendWhatsApp}
      />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <main className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 p-4 pb-24">
        <header className="relative rounded-xl border border-gray-800/60 bg-[#161616] px-5 py-4 pr-44 shadow-lg">
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-wide text-gray-100">Planify V5</h1>
            <p className="mt-1 truncate text-xs text-gray-500">
              Ctrl + Enter gerar · Ctrl + L limpar · Ctrl + H ajuda
            </p>
          </div>

          <div className="mt-3 hidden max-w-xl sm:block">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-gray-400">{statusMessage}</span>
              <span className="font-bold text-[#3498DB]">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2980B9] to-[#3498DB] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <span className={`absolute bottom-4 right-4 hidden items-center gap-2 text-xs lg:inline-flex ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {wsConnected ? 'Online' : 'Reconectando'}
          </span>

          <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLogsOpen(true)}
              title="Abrir console de logs"
              aria-label="Abrir console de logs"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-sm font-black text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white"
            >
              {'>'}
              {logs.length > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-400" />}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Abrir Hub de Configurações"
              aria-label="Abrir Hub de Configurações"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-lg text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ⚙️
            </button>

            <button
              type="button"
              onClick={startTour}
              title="Abrir tutorial interativo (Ctrl + H)"
              aria-label="Abrir tutorial interativo"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-lg font-black text-blue-200 transition-colors hover:border-blue-400 hover:bg-blue-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ?
            </button>
          </div>
        </header>

        <TopDashboard />

        <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
          <SidePanel />

          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-h-[360px]">
              <ExcelPreview />
            </div>

            <div className="sticky bottom-4 z-30 rounded-xl border border-gray-800/60 bg-[#1A1A1A]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-gray-100">Pronto para gerar</h2>
                  <p className={`mt-1 text-xs ${missingCritical ? 'text-yellow-300' : 'text-gray-500'}`}>
                    {missingCritical
                      ? 'Carregue o Sintético, escolha Modelo e BDI antes de gerar.'
                      : 'O orçamento será salvo no local escolhido pelo diálogo do Windows.'}
                  </p>
                </div>

                <button
                  data-tour="generate-button"
                  onClick={runGenerationWithValidation}
                  disabled={!canClickGenerate}
                  className={`min-w-[240px] rounded-xl px-6 py-3.5 font-black text-white shadow-md transition-all duration-200 ${
                    canClickGenerate
                      ? 'bg-gradient-to-r from-[#E67E22] to-[#D35400] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'
                      : 'cursor-not-allowed bg-gray-700 opacity-70'
                  }`}
                >
                  <span className="flex flex-col items-center leading-tight">
                    <span>{isProcessing ? 'Processando...' : excelReadStatus === 'loading' ? 'Lendo planilha...' : 'Gerar orçamento'}</span>
                    <span className="mt-1 text-[11px] font-semibold text-white/70">Ctrl + Enter</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
