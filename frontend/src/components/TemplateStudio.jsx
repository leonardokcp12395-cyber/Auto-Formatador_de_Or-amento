import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../utils';
import { usePlanifyStore } from '../store/usePlanifyStore';

const systemFields = [
  { key: 'ITEM', label: 'Item', description: 'Hierarquia 1, 1.1, 1.1.1', required: false },
  { key: 'CODIGO', label: 'Código', description: 'Código do insumo/serviço', required: true },
  { key: 'BANCO', label: 'Banco', description: 'SINAPI, SEDOP, FDE...', required: false },
  { key: 'DESCRICAO', label: 'Descrição do Serviço', description: 'Texto principal do item', required: true },
  { key: 'UNID', label: 'Unidade', description: 'UN, M, M2, M3...', required: true },
  { key: 'QUANT', label: 'Quantidade', description: 'Quantidade contratada', required: true },
  { key: 'UNIT', label: 'Valor Unitário', description: 'Preço unitário sem BDI', required: true },
  { key: 'TOTAL', label: 'Preço Total', description: 'Total espelhado/calculado', required: false },
];

const defaultMapping = {
  ITEM: 'A',
  CODIGO: 'B',
  BANCO: 'C',
  DESCRICAO: 'D',
  UNID: 'E',
  QUANT: 'F',
  UNIT: 'G',
  TOTAL: 'H',
};

const requiredKeys = systemFields.filter((field) => field.required).map((field) => field.key);
const inputClass = 'w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

function columnLetter(index) {
  let value = index;
  let letter = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }

  return letter;
}

function normalizePreviewRows(preview) {
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];
  return rows.slice(0, 20);
}

export default function TemplateStudio() {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [preview, setPreview] = useState(null);
  const [templatePath, setTemplatePath] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [startRow, setStartRow] = useState('25');
  const [mapping, setMapping] = useState(defaultMapping);

  const profiles = usePlanifyStore((state) => state.profiles);
  const profilesLoading = usePlanifyStore((state) => state.profilesLoading);
  const fetchProfiles = usePlanifyStore((state) => state.fetchProfiles);
  const saveProfileFromTemplatePath = usePlanifyStore((state) => state.saveProfileFromTemplatePath);
  const deleteProfile = usePlanifyStore((state) => state.deleteProfile);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const columnOptions = useMemo(() => {
    const previewMax = Number(preview?.max_column || 0);
    const optionCount = Math.max(previewMax, 12);

    return Array.from({ length: optionCount }, (_, index) => {
      const letter = columnLetter(index + 1);
      return { letter, index: index + 1 };
    });
  }, [preview]);

  const previewRows = useMemo(() => normalizePreviewRows(preview), [preview]);
  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || ''), 'pt-BR')),
    [profiles],
  );

  const resetStudio = () => {
    setPreview(null);
    setTemplatePath('');
    setTemplateName('');
    setCompanyName('');
    setStartRow('25');
    setMapping(defaultMapping);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadTemplate = async (file) => {
    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.xlsx', '.xlsm'].includes(extension)) {
      toast.error('Use um template .xlsx ou .xlsm.');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/upload-template-preview`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || result.detail || 'Não foi possível ler o template.');
      }

      setPreview(result.preview || null);
      setTemplatePath(result.caminho_template || '');
      setTemplateName(result.nome_arquivo || file.name);
      if (!companyName.trim()) {
        setCompanyName(file.name.replace(/\.(xlsx|xlsm)$/i, '').replace(/[_-]+/g, ' '));
      }
      toast.success('Template carregado para mapeamento.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar template.');
      setPreview(null);
      setTemplatePath('');
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    uploadTemplate(event.dataTransfer.files?.[0]);
  };

  const handleMappingChange = (key, value) => {
    setMapping((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const buildMappingPayload = () => Object.entries(mapping).reduce((payload, [key, value]) => {
    if (value) payload[key] = value;
    return payload;
  }, {});

  const validate = () => {
    if (!templatePath) return 'Faça upload do template Excel antes de salvar.';
    if (!companyName.trim()) return 'Informe o nome da empresa.';
    if (!Number.isInteger(Number(startRow)) || Number(startRow) < 1) return 'A linha inicial deve ser um número maior que zero.';

    const missing = requiredKeys.filter((key) => !mapping[key]);
    if (missing.length) {
      return `Mapeie os campos obrigatórios: ${missing.join(', ')}.`;
    }

    const selectedValues = Object.values(buildMappingPayload());
    const duplicated = selectedValues.find((value, index) => selectedValues.indexOf(value) !== index);
    if (duplicated) {
      return `A coluna ${duplicated} foi usada mais de uma vez. Revise o mapeamento.`;
    }

    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);

    try {
      await saveProfileFromTemplatePath({
        nome_empresa: companyName.trim(),
        caminho_template: templatePath,
        linha_inicio: Number(startRow),
        mapa_colunas: buildMappingPayload(),
      });
      toast.success('Novo modelo salvo e selecionado.');
      resetStudio();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar o modelo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm('Eliminar este modelo e o arquivo de template associado?')) return;

    setDeletingId(profileId);
    try {
      await deleteProfile(profileId);
      toast.success('Modelo eliminado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao eliminar modelo.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-50">Estúdio Visual de Modelos</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-400">
              Crie perfis de empresas a partir de um Excel em branco. O Planify lê a estrutura do template,
              mostra uma prévia e salva o mapeamento sem mexer em código Python.
            </p>
          </div>

          <button
            type="button"
            onClick={resetStudio}
            className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-300 transition-colors hover:bg-gray-800"
          >
            Limpar Estúdio
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? 'border-purple-300 bg-purple-500/15'
                : 'border-gray-700 bg-[#151515] hover:border-purple-500/60 hover:bg-purple-500/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(event) => uploadTemplate(event.target.files?.[0])}
            />

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 text-3xl">
              📄
            </div>
            <h4 className="mt-4 text-base font-black text-gray-100">Arraste o Excel do modelo em branco</h4>
            <p className="mt-1 text-sm text-gray-500">
              Aceita .xlsx ou .xlsm. A prévia mostra até 20 linhas e 80 colunas.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-5 rounded-xl border border-purple-500/35 bg-purple-500/15 px-5 py-2.5 text-sm font-black text-purple-100 transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-500/25 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isUploading ? 'Lendo template...' : 'Selecionar Template'}
            </button>

            {templateName && (
              <div className="mx-auto mt-4 max-w-xl rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                Template carregado: {templateName}
              </div>
            )}
          </div>

          {preview && (
            <div className="rounded-2xl border border-gray-800 bg-[#151515] p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h4 className="text-base font-black text-gray-100">Dados do Perfil</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Aba lida: {preview.sheet_name || 'Planilha 1'} · Linhas: {preview.max_row || 0} · Colunas: {preview.max_column || 0}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-xl border border-emerald-500/35 bg-emerald-500/20 px-5 py-2.5 text-sm font-black text-emerald-100 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-500/30 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Novo Modelo'}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-400">Nome da Empresa</span>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Ex: Empresa Alfa"
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-400">Linha Inicial</span>
                  <input
                    type="number"
                    min="1"
                    value={startRow}
                    onChange={(event) => setStartRow(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {systemFields.map((field) => (
                  <label key={field.key} className="rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <span className="text-sm font-black text-gray-100">{field.label}</span>
                        <p className="mt-0.5 text-[11px] text-gray-500">{field.description}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                        field.required ? 'bg-red-500/15 text-red-200' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {field.required ? 'Obrigatório' : 'Opcional'}
                      </span>
                    </div>

                    <select
                      value={mapping[field.key] || ''}
                      onChange={(event) => handleMappingChange(field.key, event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Não mapear</option>
                      {columnOptions.map((column) => (
                        <option key={`${field.key}-${column.letter}`} value={column.letter}>
                          Coluna {column.letter}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="rounded-2xl border border-gray-800 bg-[#151515] p-5">
              <div className="mb-4">
                <h4 className="text-base font-black text-gray-100">Prévia do Template</h4>
                <p className="mt-1 text-xs text-gray-500">Use as letras do cabeçalho para escolher onde cada variável será escrita.</p>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-800 custom-scrollbar">
                <table className="w-full min-w-max text-left text-xs text-gray-300">
                  <thead className="sticky top-0 z-10 bg-gray-900 text-gray-100">
                    <tr>
                      <th className="border-b border-gray-800 px-3 py-2 text-gray-500">#</th>
                      {columnOptions.map((column) => (
                        <th key={column.letter} className="border-b border-gray-800 px-3 py-2">
                          {column.letter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={columnOptions.length + 1} className="px-4 py-8 text-center text-gray-500">
                          Nenhuma célula preenchida foi encontrada nas primeiras linhas.
                        </td>
                      </tr>
                    ) : previewRows.map((row, rowIndex) => (
                      <tr key={`preview-${rowIndex}`} className="border-b border-gray-900/80 hover:bg-gray-800/45">
                        <td className="sticky left-0 bg-gray-950 px-3 py-2 font-bold text-gray-500">{rowIndex + 1}</td>
                        {columnOptions.map((column, columnIndex) => {
                          const value = row[columnIndex] ?? '';
                          return (
                            <td key={`${rowIndex}-${column.letter}`} className="max-w-[220px] truncate px-3 py-2" title={String(value)}>
                              {String(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-gray-800 bg-[#151515] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-black text-gray-100">Modelos Guardados</h4>
              <p className="mt-1 text-xs text-gray-500">Estes perfis aparecem no seletor da tela principal.</p>
            </div>
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-black text-gray-400">
              {sortedProfiles.length}
            </span>
          </div>

          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {profilesLoading ? (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-5 text-center text-sm font-bold text-blue-100">
                Carregando modelos...
              </div>
            ) : sortedProfiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 px-4 py-8 text-center text-sm text-gray-500">
                Nenhum modelo cadastrado.
              </div>
            ) : sortedProfiles.map((profile) => (
              <article key={profile.id} className="rounded-xl border border-gray-800 bg-gray-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h5 className="truncate text-sm font-black text-gray-100">{profile.nome_empresa}</h5>
                    <p className="mt-1 text-xs text-gray-500">Linha inicial: {profile.linha_inicio}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    disabled={deletingId === profile.id}
                    className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-500 transition-colors hover:border-red-500/70 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-wait disabled:opacity-60"
                    title="Eliminar modelo"
                    aria-label={`Eliminar modelo ${profile.nome_empresa}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(profile.mapa_colunas || {}).map(([key, value]) => (
                    <span key={`${profile.id}-${key}`} className="rounded-full border border-gray-800 bg-gray-900 px-2 py-1 text-[10px] font-bold text-gray-400">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
