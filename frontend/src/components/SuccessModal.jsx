export default function SuccessModal({ isOpen, result, onClose, onOpenFolder, onWhatsApp }) {
  if (!isOpen || !result) return null;

  const excelPath = result.caminho_excel || result.file_url || '';
  const pdfPath = result.caminho_pdf || '';

  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm animate-fade-in">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-emerald-400/25 bg-[#171717] p-6 shadow-2xl shadow-black/60 transition-all duration-200 animate-scale-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300 shadow-inner">
          🎉
        </div>

        <div className="mt-5 text-center">
          <h2 className="text-xl font-black text-gray-50">Orçamento Gerado com Sucesso!</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            O arquivo foi salvo no caminho escolhido.
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arquivo Excel</p>
          <p className="mt-1 break-all text-sm text-gray-200">{excelPath || 'Caminho não informado.'}</p>

          {pdfPath && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">PDF</p>
              <p className="mt-1 break-all text-sm text-gray-200">{pdfPath}</p>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenFolder}
            className="rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-3 text-sm font-bold text-blue-100 transition-all hover:-translate-y-0.5 hover:border-blue-300/70 hover:bg-blue-500/25 active:translate-y-0"
          >
            📂 Abrir Pasta
          </button>

          <button
            type="button"
            onClick={onWhatsApp}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 transition-all hover:-translate-y-0.5 hover:border-emerald-300/70 hover:bg-emerald-500/25 active:translate-y-0"
          >
            💬 Enviar p/ WhatsApp
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-700"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
