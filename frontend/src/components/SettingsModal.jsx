import { useEffect, useState } from 'react';
import { usePlanifyStore } from '../store/usePlanifyStore';
import TemplateStudio from './TemplateStudio';

const tabs = [
  { id: 'system', label: '💻 SISTEMA' },
  { id: 'studio', label: '🎨 ESTÚDIO DE MODELOS' },
  { id: 'database', label: '🗄️ BANCO DE DADOS' },
];

const autocompleteSections = [
  { key: 'bdis', title: 'BDIs (%)', description: 'Percentuais disponíveis no seletor principal. Ex: 28,82.', inputMode: 'decimal' },
  { key: 'fiscal', title: 'Fiscais', description: 'Responsáveis pela fiscalização do serviço.' },
  { key: 'elaborador', title: 'Elaboradores', description: 'Servidores/técnicos que elaboram orçamentos.' },
  { key: 'estagiario', title: 'Estagiários', description: 'Nomes usados no cabeçalho do orçamento.' },
  { key: 'setor', title: 'Setores', description: 'Unidades, prédios e setores frequentes.' },
];

const panelClass = 'rounded-2xl border border-gray-800 bg-[#151515] p-5 shadow-inner';
const inputClass = 'w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

function normalizeEntry(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeBdiEntry(value) {
  const text = String(value || '').replace('%', '').replace(',', '.').trim();
  if (!text) return '';

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return '';

  const decimalValue = parsed > 1 ? parsed / 100 : parsed;
  return decimalValue.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeSectionEntry(section, value) {
  return section.key === 'bdis' ? normalizeBdiEntry(value) : normalizeEntry(value);
}

function formatBdiLabel(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return String(value || '');

  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return `${percent.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

function formatSectionValue(section, value) {
  return section.key === 'bdis' ? formatBdiLabel(value) : value;
}

function AutocompleteCard({ section, values, inputValue, onInputChange, onAdd, onRemove }) {
  return (
    <article className="rounded-2xl border border-gray-800 bg-[#151515] p-4 shadow-inner">
      <div className="mb-4">
        <h4 className="text-sm font-black text-gray-100">{section.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{section.description}</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode={section.inputMode || 'text'}
          value={inputValue || ''}
          onChange={(event) => onInputChange(section.key, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAdd(section);
            }
          }}
          placeholder={section.key === 'bdis' ? 'Ex: 28,82' : `Adicionar em ${section.title}`}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => onAdd(section)}
          className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-100 transition-colors hover:border-blue-300 hover:bg-blue-500/25"
        >
          Adicionar
        </button>
      </div>

      <div className="mt-4 flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {values.length === 0 ? (
          <div className="w-full rounded-xl border border-dashed border-gray-700 bg-gray-950/50 px-3 py-4 text-center text-xs text-gray-500">
            Nenhum item cadastrado.
          </div>
        ) : values.map((value) => (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-200"
          >
            <span className="truncate">{formatSectionValue(section, value)}</span>
            <button
              type="button"
              onClick={() => onRemove(section.key, value)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-800 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-red-200"
              aria-label={`Remover ${value}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </article>
  );
}

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('system');
  const [autocompleteDraft, setAutocompleteDraft] = useState({});
  const [autocompleteInputs, setAutocompleteInputs] = useState({});
  const [isSavingAutocomplete, setIsSavingAutocomplete] = useState(false);
  const {
    currentVersion,
    latestVersion,
    updateAvailable,
    updateUrl,
    updateNotes,
    updateCheckedAt,
    updateError,
    isCheckingUpdates,
    isDownloadingUpdate,
    fetchCurrentVersion,
    checkForUpdates,
    installUpdate,
    clearBudgetHistory,
    resetPreferences,
    configData,
    setConfigField,
    autocompleteLoading,
    fetchAutocomplete,
    saveAutocomplete,
  } = usePlanifyStore();

  useEffect(() => {
    if (isOpen && !currentVersion) {
      fetchCurrentVersion();
    }
  }, [currentVersion, fetchCurrentVersion, isOpen]);

  useEffect(() => {
    let cancelled = false;

    if (isOpen && activeTab === 'database') {
      fetchAutocomplete().then((suggestions) => {
        if (!cancelled) {
          setAutocompleteDraft(suggestions || {});
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchAutocomplete, isOpen]);

  if (!isOpen) return null;

  const handleConfigChange = (event) => {
    const { name, value, type, checked } = event.target;
    setConfigField(name, type === 'checkbox' ? checked : value);
  };

  const handleClearHistory = () => {
    if (window.confirm('Limpar todo o histórico de orçamentos? Esta ação não pode ser desfeita.')) {
      clearBudgetHistory();
    }
  };

  const handleResetPreferences = () => {
    if (window.confirm('Resetar preferências salvas, incluindo último BDI e último modelo?')) {
      resetPreferences();
    }
  };

  const handleAutocompleteInputChange = (key, value) => {
    setAutocompleteInputs((current) => ({ ...current, [key]: value }));
  };

  const handleAddAutocomplete = (sectionOrKey) => {
    const section = typeof sectionOrKey === 'string'
      ? autocompleteSections.find((item) => item.key === sectionOrKey) || { key: sectionOrKey }
      : sectionOrKey;
    const key = section.key;
    const entry = normalizeSectionEntry(section, autocompleteInputs[key]);
    if (!entry) return;

    setAutocompleteDraft((current) => {
      const currentValues = Array.isArray(current[key]) ? current[key] : [];
      const alreadyExists = currentValues.some((value) => normalizeSectionEntry(section, value) === entry);
      if (alreadyExists) return current;

      const nextValues = [...currentValues, entry];
      return {
        ...current,
        [key]: section.key === 'bdis'
          ? nextValues.sort((a, b) => Number(a) - Number(b))
          : nextValues.sort((a, b) => a.localeCompare(b, 'pt-BR')),
      };
    });

    setAutocompleteInputs((current) => ({ ...current, [key]: '' }));
  };

  const handleRemoveAutocomplete = (key, value) => {
    const section = autocompleteSections.find((item) => item.key === key) || { key };
    const target = normalizeSectionEntry(section, value);
    setAutocompleteDraft((current) => ({
      ...current,
      [key]: (Array.isArray(current[key]) ? current[key] : [])
        .filter((item) => normalizeSectionEntry(section, item) !== target),
    }));
  };

  const handleSaveAutocomplete = async () => {
    setIsSavingAutocomplete(true);
    try {
      const savedSuggestions = await saveAutocomplete(autocompleteDraft);
      if (savedSuggestions) {
        setAutocompleteDraft(savedSuggestions);
      }
    } finally {
      setIsSavingAutocomplete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm animate-fade-in md:p-4">
      <div className="mx-auto flex max-h-[calc(100vh-1.5rem)] min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border border-gray-800 bg-[#101010] shadow-2xl shadow-black/70 md:max-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-2rem)]">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-gray-800 bg-[#151515] p-5 pb-20 md:block custom-scrollbar">
          <div className="mb-8">
            <h2 className="text-lg font-black text-gray-50">Configurações</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Ajustes técnicos ficam fora do fluxo principal.
            </p>
          </div>

          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-black transition-colors ${
                  activeTab === tab.id
                    ? 'border border-blue-500/40 bg-blue-500/15 text-blue-100'
                    : 'border border-transparent text-gray-400 hover:border-gray-700 hover:bg-gray-900 hover:text-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-800 bg-[#141414] px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-gray-50">
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </h1>
              <p className="mt-1 text-xs text-gray-500">Hub administrativo do Planify.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-bold text-gray-200 transition-colors hover:bg-gray-700"
            >
              Fechar
            </button>
          </header>

          <div className="flex gap-2 overflow-x-auto border-b border-gray-800 bg-[#111111] p-3 md:hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${
                  activeTab === tab.id ? 'bg-blue-500/20 text-blue-100' : 'bg-gray-900 text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-20 custom-scrollbar">
            {activeTab === 'system' && (
              <div className="grid gap-5">
                <div className={panelClass}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-base font-black text-gray-100">Atualizações</h3>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-gray-500">
                        Verifique a versão publicada no GitHub e inicie o instalador automático quando houver uma release nova.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={checkForUpdates}
                      disabled={isCheckingUpdates}
                      className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-4 py-2.5 text-sm font-black text-blue-100 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-500/25 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {isCheckingUpdates ? 'Verificando...' : 'Verificar Atualizações'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Versão atual</p>
                      <p className="mt-2 text-lg font-black text-gray-100">{currentVersion || 'Não verificada'}</p>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Última versão</p>
                      <p className="mt-2 text-lg font-black text-gray-100">{latestVersion || 'Não consultada'}</p>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Status</p>
                      <p className={`mt-2 text-sm font-bold ${updateAvailable ? 'text-emerald-300' : 'text-gray-300'}`}>
                        {updateAvailable ? 'Atualização disponível' : updateCheckedAt ? 'Sem atualização pendente' : 'Aguardando verificação'}
                      </p>
                    </div>
                  </div>

                  {updateError && (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {updateError}
                    </div>
                  )}

                  {updateAvailable && (
                    <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                      <p className="text-sm font-bold text-emerald-100">Nova versão pronta para instalação.</p>
                      {updateNotes && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-50/80">{updateNotes}</p>}
                      {updateUrl && <p className="mt-2 break-all text-xs text-emerald-100/70">{updateUrl}</p>}
                      <button
                        type="button"
                        onClick={installUpdate}
                        disabled={isDownloadingUpdate}
                        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isDownloadingUpdate ? 'Baixando...' : 'Baixar e Instalar'}
                      </button>
                    </div>
                  )}
                </div>

                <div className={panelClass}>
                  <h3 className="text-base font-black text-gray-100">Opções técnicas</h3>
                  <p className="mt-1 text-sm text-gray-500">Essas opções foram removidas da tela principal para reduzir ruído.</p>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-gray-400">Método de cálculo</span>
                      <select
                        name="metodo_calculo"
                        value={configData.metodo_calculo || 'exato'}
                        onChange={handleConfigChange}
                        className={inputClass}
                      >
                        <option value="exato">Exato</option>
                        <option value="cortar">Cortar casas</option>
                        <option value="arredondar">Arredondar</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-gray-400">Altura da linha</span>
                      <input
                        type="text"
                        name="altura_linha"
                        value={configData.altura_linha || '24.75'}
                        onChange={handleConfigChange}
                        className={inputClass}
                      />
                    </label>

                    <label className="flex items-end gap-3 rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm font-bold text-green-300">
                      <input
                        type="checkbox"
                        name="gerar_pdf"
                        checked={configData.gerar_pdf || false}
                        onChange={handleConfigChange}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-green-500"
                      />
                      Gerar PDF junto com Excel
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'studio' && (
              <TemplateStudio />
            )}

            {activeTab === 'database' && (
              <div className="grid gap-5">
                <div className={panelClass}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-base font-black text-gray-100">Gestão de Autocompletar</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                        Edite os nomes e setores sugeridos nos campos do formulário principal. As alterações ficam salvas no computador do usuário.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveAutocomplete}
                      disabled={isSavingAutocomplete || autocompleteLoading}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-black text-emerald-100 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      {isSavingAutocomplete ? 'Salvando...' : '💾 Salvar Alterações'}
                    </button>
                  </div>

                  {autocompleteLoading && (
                    <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-100">
                      Carregando banco de sugestões...
                    </div>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {autocompleteSections.map((section) => (
                    <AutocompleteCard
                      key={section.key}
                      section={section}
                      values={Array.isArray(autocompleteDraft[section.key]) ? autocompleteDraft[section.key] : []}
                      inputValue={autocompleteInputs[section.key] || ''}
                      onInputChange={handleAutocompleteInputChange}
                      onAdd={handleAddAutocomplete}
                      onRemove={handleRemoveAutocomplete}
                    />
                  ))}
                </div>

                <div className={panelClass}>
                  <h3 className="text-base font-black text-gray-100">Manutenção do Banco de Dados</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                    Use estas ações apenas para suporte. Elas afetam dados persistidos no computador do usuário.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5">
                    <h4 className="text-sm font-black text-red-100">Limpar Histórico de Orçamentos</h4>
                    <p className="mt-2 text-sm leading-relaxed text-red-100/70">
                      Remove registros históricos de geração. Não apaga arquivos Excel já salvos no disco.
                    </p>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="mt-5 rounded-xl border border-red-400/40 bg-red-600/80 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-500"
                    >
                      Limpar Histórico
                    </button>
                  </div>

                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5">
                    <h4 className="text-sm font-black text-red-100">Resetar Preferências</h4>
                    <p className="mt-2 text-sm leading-relaxed text-red-100/70">
                      Limpa último modelo, último BDI e ajustes salvos. A próxima geração exigirá nova escolha.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetPreferences}
                      className="mt-5 rounded-xl border border-red-400/40 bg-red-600/80 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-500"
                    >
                      Resetar Preferências
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
