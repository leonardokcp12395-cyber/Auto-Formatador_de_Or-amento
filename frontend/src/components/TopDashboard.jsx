import { useRef, useState } from 'react';
import { usePlanifyStore } from '../store/usePlanifyStore';

export default function TopDashboard() {
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef(null);
  const {
    excelFileName,
    excelReadStatus,
    isUploadingExcel,
    uploadError,
    uploadExcel,
    clearFile,
    extractText,
  } = usePlanifyStore();

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) await uploadExcel(file);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (file) await uploadExcel(file);
  };

  const handleClearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearFile();
  };

  const handleExtract = async () => {
    if (!text.trim()) return;
    setIsExtracting(true);

    try {
      await extractText(text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsExtracting(false);
    }
  };

  const readStatusLabel = {
    idle: 'Aguardando leitura',
    loading: 'Lendo dados da planilha...',
    success: 'Preview pronto para geração',
    error: 'Upload feito, mas a leitura falhou',
  }[excelReadStatus] || 'Aguardando leitura';

  return (
    <div className="bg-[#1A1A1A] border border-gray-800/60 shadow-lg rounded-xl p-6 lg:p-7 grid grid-cols-1 lg:grid-cols-2 gap-6 text-gray-100 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3498DB] to-[#16A085]" />

      <section className="flex flex-col gap-3 min-h-[260px]">
        <div className="flex items-center gap-2">
          <span className="bg-[#3498DB]/10 text-[#3498DB] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
          <h2 className="text-[#3498DB] font-bold text-sm tracking-wide uppercase">Sintético Excel</h2>
        </div>

        {excelFileName ? (
          <div data-tour="dropzone" className={`rounded-xl p-5 flex flex-col justify-between h-full min-h-[210px] border shadow-sm ${
            excelReadStatus === 'error'
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-blue-500/10'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className={`p-3 rounded-full shrink-0 ${excelReadStatus === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                  {excelReadStatus === 'loading' ? (
                    <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Nome do Arquivo Selecionado</p>
                  <p className="mt-1 text-base font-bold text-gray-100 break-words">{excelFileName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearFile}
                className="shrink-0 rounded-full p-2 bg-gray-900/70 border border-gray-700 text-gray-400 hover:text-red-300 hover:border-red-500/60 transition-colors"
                title="Remover arquivo"
                aria-label="Remover arquivo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 rounded-lg bg-gray-950/40 border border-gray-800 px-4 py-3 text-sm text-gray-300">
              {readStatusLabel}
            </div>
          </div>
        ) : (
          <div
            data-tour="dropzone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all duration-200 min-h-[210px] ${
              uploadError
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-gray-700 hover:border-[#3498DB]/70 hover:bg-gray-800/30'
            }`}
          >
            <svg className="w-10 h-10 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <p className="text-gray-300 text-sm font-semibold">Arraste o Excel para aqui</p>
            <p className="text-gray-500 text-xs mt-1 mb-4">Formatos aceitos: .xlsx, .xls e .xlsm</p>
            <label className="cursor-pointer bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-500 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm">
              Selecionar arquivo
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileSelect}
              />
            </label>
            {isUploadingExcel && <p className="text-xs font-medium text-[#3498DB] mt-3 animate-pulse">Enviando arquivo...</p>}
            {uploadError && <p className="text-xs font-medium text-red-300 mt-3 text-center">{uploadError}</p>}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 min-h-[260px]">
        <div className="flex items-center gap-2">
          <span className="bg-[#8E44AD]/10 text-[#8E44AD] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
          <h2 className="text-[#8E44AD] font-bold text-sm tracking-wide uppercase">Importação WhatsApp</h2>
        </div>

        <div className="flex flex-col gap-3 h-full min-h-[210px]">
          <textarea
            data-tour="whatsapp-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="flex-1 min-h-[148px] bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8E44AD] focus:border-[#8E44AD] resize-none shadow-inner"
            placeholder="Cole a mensagem do WhatsApp aqui para preencher os dados da obra."
          />
          <button
            onClick={handleExtract}
            disabled={isExtracting || !text.trim()}
            className="bg-gradient-to-r from-[#8E44AD] to-[#6C3483] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isExtracting ? 'Extraindo...' : 'Extrair dados'}
          </button>
        </div>
      </section>
    </div>
  );
}
