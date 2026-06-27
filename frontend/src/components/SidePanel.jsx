import { useEffect } from 'react';
import { usePlanifyStore } from '../store/usePlanifyStore';
import ComboboxInput from './ComboboxInput';

const inputClass = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
const selectClass = 'w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';
const fallbackBdis = ['0.2882', '0.3518'];

function formatBdiOption(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return value;

  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return `${percent.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

function InputField({ label, name, value, onChange, placeholder = '', fullWidth = false }) {
  return (
    <label className={`flex flex-col gap-1 ${fullWidth ? 'col-span-2' : 'col-span-1'}`}>
      <span className="text-[11px] font-semibold text-gray-400">{label}</span>
      <input
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

export default function SidePanel() {
  const {
    formData,
    configData,
    profiles,
    profilesLoading,
    profilesError,
    autocompleteSuggestions,
    fetchAutocomplete,
    fetchProfiles,
    setFormData,
    setConfigField,
    clearFormData,
    rememberAutocompleteValue,
  } = usePlanifyStore();

  useEffect(() => {
    fetchAutocomplete();
    if (!profiles.length && !profilesLoading) {
      fetchProfiles();
    }
  }, [fetchAutocomplete, fetchProfiles, profiles.length, profilesLoading]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData({ [name]: value });
  };

  const handleConfigChange = (event) => {
    const { name, value, type, checked } = event.target;
    setConfigField(name, type === 'checkbox' ? checked : value);
  };

  const handleComboboxChange = (name, value) => {
    setFormData({ [name]: value });
  };

  const bdiOptions = Array.isArray(autocompleteSuggestions.bdis) && autocompleteSuggestions.bdis.length
    ? autocompleteSuggestions.bdis
    : fallbackBdis;

  return (
    <aside className="rounded-xl border border-gray-800/60 bg-[#1A1A1A] p-4 pb-8 text-gray-100 shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-gray-100">Dados e Parâmetros</h2>
            <p className="mt-1 text-[11px] text-gray-500">Modelo, BDI e cabeçalho do orçamento.</p>
          </div>

          <button
            type="button"
            onClick={clearFormData}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-red-500/60 hover:bg-red-500/15 hover:text-red-200"
          >
            Limpar
          </button>
        </div>

        <section data-tour="config-panel" className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3">
          <div className="mb-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-blue-200">Obrigatório</h3>
            <p className="text-[11px] text-blue-100/60">Sem modelo e BDI a geração é bloqueada.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-300">Modelo da empresa</span>
              <select
                name="perfil_id"
                value={configData.perfil_id || ''}
                onChange={handleConfigChange}
                disabled={profilesLoading}
                className={`${selectClass} disabled:cursor-wait disabled:opacity-60`}
              >
                <option value="">{profilesLoading ? 'Carregando modelos...' : 'Escolha um modelo'}</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.nome_empresa}
                  </option>
                ))}
              </select>
              {profilesError && <span className="text-[11px] text-red-300">{profilesError}</span>}
              <span className="text-[11px] text-blue-100/45">Gerencie modelos no Hub de Configurações.</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-300">BDI</span>
              <select
                name="bdi"
                value={configData.bdi || ''}
                onChange={handleConfigChange}
                className={selectClass}
              >
                <option value="">Escolha</option>
                {bdiOptions.map((bdi) => (
                  <option key={bdi} value={bdi}>
                    {formatBdiOption(bdi)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="mt-4 pb-20">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nome do arquivo" name="nome_arquivo" value={formData.nome_arquivo} onChange={handleChange} placeholder="Orcamento_Gerado" fullWidth />

            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-400">Descrição</span>
              <textarea
                name="descricao_header"
                value={formData.descricao_header || ''}
                onChange={handleChange}
                placeholder="Objeto do orçamento"
                rows={2}
                className={`${inputClass} resize-none leading-relaxed`}
              />
            </label>

            <ComboboxInput label="Campus" name="campus" value={formData.campus} suggestions={autocompleteSuggestions.campus} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />
            <ComboboxInput label="Setor" name="setor" value={formData.setor} suggestions={autocompleteSuggestions.setor} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />
            <ComboboxInput label="Fiscal" name="fiscal" value={formData.fiscal} suggestions={autocompleteSuggestions.fiscal} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />
            <ComboboxInput label="Servidor" name="servidor" value={formData.servidor} suggestions={autocompleteSuggestions.servidor} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />
            <ComboboxInput label="Elaborador" name="elaborador" value={formData.elaborador} suggestions={autocompleteSuggestions.elaborador} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />
            <ComboboxInput label="Estagiário" name="estagiario" value={formData.estagiario} suggestions={autocompleteSuggestions.estagiario} onChange={handleComboboxChange} onCommit={rememberAutocompleteValue} />

            <InputField label="Processo" name="processo" value={formData.processo} onChange={handleChange} placeholder="Número do processo SEI" fullWidth />
            <InputField label="Data" name="data" value={formData.data} onChange={handleChange} />
            <InputField label="Prazo" name="prazo" value={formData.prazo} onChange={handleChange} />
            <InputField label="Orçafascio" name="orcafascio" value={formData.orcafascio} onChange={handleChange} />
            <InputField label="Nº orçamento" name="num_orcamento" value={formData.num_orcamento} onChange={handleChange} />
            <InputField label="Emissão" name="data_emissao" value={formData.data_emissao} onChange={handleChange} />
            <InputField label="Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} />
            <InputField label="Empenho" name="empenho" value={formData.empenho} onChange={handleChange} />
            <InputField label="Valor simulado" name="valor_simulado" value={formData.valor_simulado} onChange={handleChange} placeholder="0,00" />
          </div>
        </div>
      </aside>
  );
}
