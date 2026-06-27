import { useState } from 'react';
import TemplateManagerModal from './TemplateManagerModal';
import { usePlanifyStore } from '../store/usePlanifyStore';

const controlClass = 'bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';

export default function ConfigPanel() {
  const { configData, setConfigField } = usePlanifyStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setConfigField(name, type === 'checkbox' ? checked : value);
  };

  return (
    <>
      <section className="rounded-xl border border-gray-800/60 bg-[#1A1A1A] p-4 text-white shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-100">Ajustes avançados</h2>
            <p className="mt-1 text-xs text-gray-500">Modelo e BDI ficam no fluxo principal.</p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-200 transition-colors hover:border-blue-400/70 hover:bg-blue-500/20"
          >
            Gerir Modelos
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-400">Método</span>
            <select
              name="metodo_calculo"
              value={configData.metodo_calculo || 'exato'}
              onChange={handleChange}
              className={controlClass}
            >
              <option value="exato">Exato</option>
              <option value="cortar">Cortar</option>
              <option value="arredondar">Arredondar</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-gray-400">Altura linha</span>
            <input
              type="text"
              name="altura_linha"
              value={configData.altura_linha || '24.75'}
              onChange={handleChange}
              className={controlClass}
            />
          </label>

          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-green-400">
            <input
              type="checkbox"
              name="gerar_pdf"
              checked={configData.gerar_pdf || false}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-green-500"
            />
            Gerar PDF
          </label>
        </div>
      </section>

      <TemplateManagerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
