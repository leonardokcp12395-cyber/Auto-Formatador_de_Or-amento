import { usePlanifyStore } from '../store/usePlanifyStore';

function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function EmptyState({ title, message, tone = 'neutral' }) {
  const toneClass = tone === 'error' ? 'text-red-300 bg-red-500/10' : 'text-gray-500 bg-gray-800/50';

  return (
    <div className="bg-[#1A1A1A] border border-gray-800/60 shadow-inner rounded-xl p-8 flex h-full min-h-[260px] items-center justify-center">
      <div className="text-center max-w-md">
        <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${toneClass}`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="text-gray-200 font-semibold text-lg mb-2">{title}</div>
        <div className="text-gray-500 text-sm leading-relaxed">{message}</div>
      </div>
    </div>
  );
}

export default function ExcelPreview() {
  const data = usePlanifyStore((state) => state.tableData);
  const fileName = usePlanifyStore((state) => state.excelFileName);
  const status = usePlanifyStore((state) => state.excelReadStatus);
  const error = usePlanifyStore((state) => state.excelReadError);

  if (status === 'loading') {
    return (
      <div className="bg-[#1A1A1A] border border-gray-800/60 shadow-inner rounded-xl p-8 flex h-full min-h-[260px] items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <div className="text-gray-200 font-semibold">Lendo planilha</div>
          <div className="text-gray-500 text-sm mt-1">{fileName || 'Aguarde enquanto os dados são preparados.'}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <EmptyState
        title="Não foi possível exibir o preview"
        message={error || 'O arquivo foi enviado, mas o backend não conseguiu ler os dados.'}
        tone="error"
      />
    );
  }

  if (!data.length) {
    return (
      <EmptyState
        title={fileName ? 'Planilha sem linhas de dados' : 'Nenhum dado carregado'}
        message={fileName ? 'O arquivo foi lido, mas não há registros para montar a tabela.' : 'Faça upload de uma planilha Excel para visualizar o preview antes de gerar o orçamento.'}
      />
    );
  }

  const columns = Object.keys(data[0] || {});
  const previewRows = data.slice(0, 100);

  if (!columns.length) {
    return (
      <EmptyState
        title="Cabeçalho não encontrado"
        message="A planilha carregada não possui colunas reconhecíveis para montar o preview."
        tone="error"
      />
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-gray-800/60 shadow-inner rounded-xl overflow-hidden flex h-full min-h-[320px] flex-col">
      <div className="px-5 py-4 bg-gray-900/70 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
        <div>
          <span className="font-bold text-gray-100">Preview do Excel</span>
          {fileName && <span className="text-gray-500 ml-2 break-all">{fileName}</span>}
        </div>
        <span className="text-gray-400">Mostrando {previewRows.length} de {data.length} linhas</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="sticky top-0 bg-gray-800 text-gray-200 font-bold z-10 shadow-sm">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 border-b border-gray-700 whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${formatCell(row[columns[0]])}`}
                className={`${rowIndex % 2 === 0 ? 'bg-gray-950/20' : 'bg-gray-900/20'} hover:bg-gray-700/50 border-b border-gray-800/80 transition-colors`}
              >
                {columns.map((column) => {
                  const value = formatCell(row[column]);
                  return (
                    <td key={column} className="px-4 py-2.5 whitespace-nowrap max-w-xs truncate" title={value}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
