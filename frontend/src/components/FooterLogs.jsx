export default function FooterLogs({ logs, progress, hideProgress = false }) {
  return (
    <div className="bg-[#0A0A0A] w-full flex flex-col rounded-xl overflow-hidden shadow-inner border border-gray-800/80">
      {!hideProgress && (
        <div className="w-full bg-gray-800 h-1.5 overflow-hidden">
          <div
            className="bg-[#3498DB] h-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* Terminal / Logs Console */}
      <div className="bg-[#0A0A0A] p-4 font-mono text-[11px] overflow-y-auto h-40 flex flex-col gap-1.5 custom-scrollbar">
        {logs.length === 0 ? (
          <span className="text-gray-500">Aguardando início do processo...</span>
        ) : (
          logs.map((log, index) => {
            let colorClass = "text-gray-400"; // INFO
            if (log.level === "SUCCESS") colorClass = "text-green-500";
            if (log.level === "ERROR") colorClass = "text-red-500";

            return (
              <div key={index} className="flex gap-2">
                <span className="text-gray-600">[{log.timestamp || new Date().toLocaleTimeString()}]</span>
                <span className={colorClass}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
