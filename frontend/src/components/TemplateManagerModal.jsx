import { useMemo, useState } from 'react';
import { usePlanifyStore } from '../store/usePlanifyStore';

const requiredColumns = [
  { key: 'CODIGO', label: 'Coluna Código', placeholder: 'B' },
  { key: 'DESCRICAO', label: 'Coluna Descrição', placeholder: 'D' },
  { key: 'UNID', label: 'Coluna Unidade', placeholder: 'E' },
  { key: 'QUANT', label: 'Coluna Quantidade', placeholder: 'F' },
  { key: 'UNIT', label: 'Coluna Valor Unitário', placeholder: 'G' },
];

const optionalColumns = [
  { key: 'ITEM', label: 'Coluna Item', placeholder: 'A' },
  { key: 'BANCO', label: 'Coluna Banco/Fonte', placeholder: 'C' },
  { key: 'TOTAL', label: 'Coluna Total', placeholder: 'H' },
];

const initialColumnMap = {
  ITEM: 'A',
  CODIGO: 'B',
  BANCO: 'C',
  DESCRICAO: 'D',
  UNID: 'E',
  QUANT: 'F',
  UNIT: 'G',
  TOTAL: 'H',
};

function normalizeColumnInput(value) {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

export default function TemplateManagerModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [linhaInicio, setLinhaInicio] = useState('25');
  const [mapaColunas, setMapaColunas] = useState(initialColumnMap);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const profiles = usePlanifyStore((state) => state.profiles);
  const saveProfile = usePlanifyStore((state) => state.saveProfile);
  const deleteProfile = usePlanifyStore((state) => state.deleteProfile);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => a.nome_empresa.localeCompare(b.nome_empresa)),
    [profiles],
  );

  if (!isOpen) return null;

  const resetForm = () => {
    setFile(null);
    setNomeEmpresa('');
    setLinhaInicio('25');
    setMapaColunas(initialColumnMap);
  };

  const handleColumnChange = (key, value) => {
    setMapaColunas((prev) => ({ ...prev, [key]: normalizeColumnInput(value) }));
  };

  const buildColumnPayload = () => {
    return Object.entries(mapaColunas).reduce((acc, [key, value]) => {
      if (value) acc[key] = value;
      return acc;
    }, {});
  };

  const validate = () => {
    if (!file) return 'Selecione o Excel em branco do template.';
    if (!nomeEmpresa.trim()) return 'Informe o nome da empresa.';
    if (!Number.isInteger(Number(linhaInicio)) || Number(linhaInicio) < 1) {
      return 'A linha de início deve ser um número maior que zero.';
    }

    const missing = requiredColumns.filter(({ key }) => !mapaColunas[key]);
    if (missing.length) {
      return `Preencha: ${missing.map((item) => item.label).join(', ')}.`;
    }

    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setSuccess('');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    const profile = {
      nome_empresa: nomeEmpresa.trim(),
      linha_inicio: Number(linhaInicio),
      mapa_colunas: buildColumnPayload(),
    };

    try {
      await saveProfile({ file, profile });
      setSuccess('Perfil salvo com sucesso.');
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao salvar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (perfilId) => {
    const confirmed = window.confirm('Remover este perfil e o template associado?');
    if (!confirmed) return;

    setDeletingId(perfilId);
    setError('');
    setSuccess('');

    try {
      await deleteProfile(perfilId);
      setSuccess('Perfil removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao remover perfil.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl border border-gray-700 bg-[#141414] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-100">Gerir Modelos</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cadastre templates de empresas e defina onde cada campo do orçamento será escrito.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-700 bg-gray-900 p-2 text-gray-400 transition-colors hover:border-red-500/70 hover:text-red-300"
            aria-label="Fechar modal"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-96px)] grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] custom-scrollbar">
          <section className="border-b border-gray-800 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-300">1</span>
              <div>
                <h3 className="font-semibold text-gray-100">Novo perfil de empresa</h3>
                <p className="text-xs text-gray-500">Use um template vazio em .xlsx ou .xlsm.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-gray-400">Template Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="block w-full cursor-pointer rounded-xl border border-gray-700 bg-gray-900 text-sm text-gray-300 file:mr-4 file:border-0 file:bg-blue-600 file:px-4 file:py-3 file:font-semibold file:text-white hover:file:bg-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-400">Nome da Empresa</span>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(event) => setNomeEmpresa(event.target.value)}
                  placeholder="Ex: Empresa Alfa"
                  className="rounded-xl border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-gray-200 shadow-inner outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-400">Linha de início</span>
                <input
                  type="number"
                  min="1"
                  value={linhaInicio}
                  onChange={(event) => setLinhaInicio(event.target.value)}
                  className="rounded-xl border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm text-gray-200 shadow-inner outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-300">2</span>
                <div>
                  <h3 className="font-semibold text-gray-100">Mapeamento de colunas do template</h3>
                  <p className="text-xs text-gray-500">Digite apenas a letra da coluna onde o dado deve ser escrito.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {requiredColumns.map((column) => (
                  <label key={column.key} className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-gray-400">{column.label}</span>
                    <input
                      type="text"
                      value={mapaColunas[column.key] || ''}
                      onChange={(event) => handleColumnChange(column.key, event.target.value)}
                      placeholder={column.placeholder}
                      className="rounded-xl border border-gray-700 bg-gray-900 px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wide text-gray-200 shadow-inner outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {optionalColumns.map((column) => (
                  <label key={column.key} className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-gray-500">{column.label}</span>
                    <input
                      type="text"
                      value={mapaColunas[column.key] || ''}
                      onChange={(event) => handleColumnChange(column.key, event.target.value)}
                      placeholder={column.placeholder}
                      className="rounded-xl border border-gray-800 bg-gray-900 px-3.5 py-2.5 text-sm font-semibold uppercase tracking-wide text-gray-300 shadow-inner outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {(error || success) && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                error
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}>
                {error || success}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Guardando...' : 'Guardar Perfil'}
              </button>
            </div>
          </section>

          <aside className="p-6">
            <div className="mb-5">
              <h3 className="font-semibold text-gray-100">Perfis existentes</h3>
              <p className="mt-1 text-xs text-gray-500">Templates disponíveis no seletor de modelos.</p>
            </div>

            <div className="space-y-3">
              {sortedProfiles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-5 text-center text-sm text-gray-500">
                  Nenhum perfil cadastrado.
                </div>
              ) : sortedProfiles.map((perfil) => (
                <div key={perfil.id} className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-100">{perfil.nome_empresa}</p>
                      <p className="mt-1 text-xs text-gray-500">Linha inicial: {perfil.linha_inicio}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(perfil.id)}
                      disabled={deletingId === perfil.id}
                      className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-500 transition-colors hover:border-red-500/70 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Remover perfil"
                      aria-label={`Remover perfil ${perfil.nome_empresa}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1 text-[11px] text-gray-500">
                    {Object.entries(perfil.mapa_colunas || {}).map(([key, value]) => (
                      <span key={key} className="rounded bg-gray-900 px-2 py-1">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
