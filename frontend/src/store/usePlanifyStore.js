import { create } from 'zustand';
import toast from 'react-hot-toast';
import { API_BASE } from '../utils';

const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/leonardokcp12395-cyber/auto-formatador_de_or-amento/main/version.json';

const DEFAULT_CONFIG = {
  modelo: '',
  perfil_id: '',
  bdi: '',
  metodo_calculo: 'exato',
  altura_linha: '24.75',
  gerar_pdf: false,
  mapeamento: {},
};

const COLUMN_ALIASES = {
  ITEM: ['ITEM', 'ITEM ORCAMENTO', 'ITEM ORÇAMENTO'],
  CODIGO: ['CODIGO', 'CÓDIGO', 'COD', 'COD.'],
  BANCO: ['BANCO', 'FONTE', 'BASE', 'REFERENCIA', 'REFERÊNCIA'],
  DESCRICAO: ['DESCRICAO', 'DESCRIÇÃO', 'DISCRIMINACAO', 'DISCRIMINAÇÃO', 'SERVICO', 'SERVIÇO'],
  UNID: ['UNID', 'UND', 'UNIDADE', 'UN'],
  QUANT: ['QUANT', 'QUANT.', 'QTD', 'QTDE', 'QUANTIDADE'],
  UNIT: ['UNIT', 'UNITARIO', 'UNITÁRIO', 'VALOR UNIT', 'VALOR UNIT.', 'PRECO UNITARIO', 'PREÇO UNITÁRIO'],
};

const SUPPORTED_EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];

const FALLBACK_AUTOCOMPLETE = {
  campus: ['BELÉM', 'TUCURUÍ', 'CASTANHAL', 'ALTAMIRA', 'BREVES', 'SOURE'],
  setor: ['CEPS', 'REITORIA', 'PROAD', 'RESTAURANTE UNIVERSITÁRIO', 'CTIC'],
  servidor: [],
  elaborador: ['ROMULO DAVI', 'RÔMULO LOPES', 'ARNALDO AGUIAR', 'ALLAN CARDOSO'],
  estagiario: ['LEONARDO KAUA'],
  fiscal: ['ROMULO DAVI', 'RÔMULO LOPES', 'ARNALDO AGUIAR', 'ALLAN CARDOSO'],
  bdis: ['0.2882', '0.3518'],
};

function compareVersions(a, b) {
  const left = String(a || '0').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = String(b || '0').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function buildLog(message, level = 'INFO') {
  return { message, level, timestamp: new Date().toLocaleTimeString() };
}

function getFileExtension(fileName) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function normalizeColumnName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function inferColumnMapping(rows) {
  const columns = Object.keys(rows?.[0] ?? {});
  const normalizedIndex = columns.reduce((acc, column) => {
    acc[normalizeColumnName(column)] = column;
    return acc;
  }, {});

  return Object.entries(COLUMN_ALIASES).reduce((mapping, [canonical, aliases]) => {
    const match = aliases.map(normalizeColumnName).find((alias) => normalizedIndex[alias]);
    mapping[canonical] = match ? normalizedIndex[match] : canonical;
    return mapping;
  }, {});
}

function normalizeBdiValue(value) {
  const text = String(value || '').replace('%', '').replace(',', '.').trim();
  if (!text) return '';

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return '';

  const decimalValue = parsed > 1 ? parsed / 100 : parsed;
  return decimalValue.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function normalizeSuggestionValue(key, value) {
  if (key === 'bdis') return normalizeBdiValue(value);
  return String(value || '').trim();
}

function sortSuggestionValues(key, values) {
  if (key === 'bdis') {
    return values.sort((a, b) => Number(a) - Number(b));
  }

  return values.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function normalizeSuggestions(payload) {
  return Object.entries({ ...FALLBACK_AUTOCOMPLETE, ...(payload || {}) }).reduce((acc, [key, values]) => {
    const cleanKey = String(key || '').trim().toLowerCase();
    if (!cleanKey) return acc;

    acc[cleanKey] = sortSuggestionValues(cleanKey, [...new Set((Array.isArray(values) ? values : [])
      .map((value) => normalizeSuggestionValue(cleanKey, value))
      .filter(Boolean))]);
    return acc;
  }, {});
}

function normalizeEditableSuggestions(payload) {
  return Object.entries(payload || {}).reduce((acc, [key, values]) => {
    const cleanKey = String(key || '').trim().toLowerCase();
    if (!cleanKey) return acc;

    acc[cleanKey] = sortSuggestionValues(cleanKey, [...new Set((Array.isArray(values) ? values : [])
      .map((value) => {
        if (cleanKey === 'bdis') return normalizeBdiValue(value);
        return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
      })
      .filter(Boolean))]);
    return acc;
  }, {});
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Falha na comunicação com o backend.');
  }
  return data;
}

export const usePlanifyStore = create((set, get) => ({
  formData: {},
  configData: DEFAULT_CONFIG,
  tableData: [],
  profiles: [],

  excelPath: null,
  excelFileName: '',
  excelInfo: {},
  excelReadStatus: 'idle',
  excelReadError: '',
  uploadError: '',
  isUploadingExcel: false,

  profilesLoading: false,
  profilesError: '',
  autocompleteSuggestions: FALLBACK_AUTOCOMPLETE,
  autocompleteLoading: false,

  logs: [],
  progress: 0,
  isProcessing: false,
  showLogs: false,
  statusMessage: 'Aguardando início do processo...',
  generationResult: null,
  currentTaskId: null,
  wsConnected: false,

  currentVersion: '',
  latestVersion: '',
  updateAvailable: false,
  updateUrl: '',
  updateCheckedAt: null,
  updateError: '',
  isCheckingUpdates: false,
  isDownloadingUpdate: false,

  setFormData: (patch) => set((state) => ({
    formData: typeof patch === 'function' ? patch(state.formData) : { ...state.formData, ...patch },
  })),

  clearFormData: () => set({ formData: {} }),

  setConfigData: (patch) => set((state) => ({
    configData: typeof patch === 'function' ? patch(state.configData) : { ...state.configData, ...patch },
  })),

  setConfigField: (name, value) => set((state) => ({
    configData: {
      ...state.configData,
      [name]: value,
      ...(name === 'perfil_id' ? { modelo: value } : {}),
    },
  })),

  setTableData: (tableData) => set({ tableData: Array.isArray(tableData) ? tableData : [] }),

  appendLog: (message, level = 'INFO') => set((state) => ({
    logs: [...state.logs, buildLog(message, level)],
    statusMessage: message,
  })),

  setProgress: (progress) => set({ progress }),
  setShowLogs: (showLogs) => set({ showLogs }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  fetchCurrentVersion: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/version`);
      const data = await readJsonResponse(response);
      set({ currentVersion: data.version || '' });
      return data.version || '';
    } catch {
      return '';
    }
  },

  checkForUpdates: async () => {
    set({ isCheckingUpdates: true, updateError: '' });

    try {
      const localResponse = await fetch(`${API_BASE}/api/version`);
      const localData = await readJsonResponse(localResponse);

      const remoteResponse = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
      if (!remoteResponse.ok) {
        throw new Error('Não foi possível consultar o manifesto de atualização.');
      }

      const remoteData = await remoteResponse.json();
      const currentVersion = localData.version || '';
      const latestVersion = remoteData.version || '';
      const updateUrl = remoteData.download_url || remoteData.url || '';
      const hasUpdate = Boolean(latestVersion && compareVersions(latestVersion, currentVersion) > 0);

      set({
        currentVersion,
        latestVersion,
        updateAvailable: hasUpdate,
        updateUrl: hasUpdate ? updateUrl : '',
        updateCheckedAt: new Date().toISOString(),
        isCheckingUpdates: false,
      });

      toast.success(hasUpdate ? `Nova versão disponível: ${latestVersion}` : 'Você já está na versão mais recente.');

      return { updateAvailable: hasUpdate, currentVersion, latestVersion, updateUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao verificar atualizações.';
      toast.error(message);
      set({
        isCheckingUpdates: false,
        updateError: message,
      });
      return null;
    }
  },

  installUpdate: async () => {
    const updateUrl = get().updateUrl;
    if (!updateUrl) {
      toast.error('Nenhuma atualização disponível para instalar.');
      return null;
    }

    set({ isDownloadingUpdate: true });

    try {
      const response = await fetch(`${API_BASE}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_url: updateUrl }),
      });
      const result = await readJsonResponse(response);
      toast.success('Atualização iniciada. O aplicativo será reiniciado.');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar atualização.';
      toast.error(message);
      set({ isDownloadingUpdate: false });
      return null;
    }
  },

  clearBudgetHistory: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/historico`, { method: 'DELETE' });
      const result = await readJsonResponse(response);
      toast.success('Histórico de orçamentos limpo.');
      get().appendLog('Histórico de orçamentos limpo pelo Hub de Configurações.', 'WARNING');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao limpar histórico.';
      toast.error(message);
      return null;
    }
  },

  resetPreferences: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/preferencias/reset`, { method: 'POST' });
      const result = await readJsonResponse(response);
      set((state) => ({
        configData: {
          ...DEFAULT_CONFIG,
          mapeamento: state.configData.mapeamento || {},
        },
      }));
      toast.success('Preferências resetadas.');
      get().appendLog('Preferências resetadas pelo Hub de Configurações.', 'WARNING');
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao resetar preferências.';
      toast.error(message);
      return null;
    }
  },

  fetchAutocomplete: async () => {
    set({ autocompleteLoading: true });

    try {
      const response = await fetch(`${API_BASE}/api/autocomplete`);
      const result = await readJsonResponse(response);
      const suggestions = normalizeSuggestions(result.sugestoes || result.autocomplete || {});
      set({
        autocompleteSuggestions: suggestions,
        autocompleteLoading: false,
      });
      return suggestions;
    } catch {
      const suggestions = normalizeSuggestions(FALLBACK_AUTOCOMPLETE);
      set({
        autocompleteSuggestions: suggestions,
        autocompleteLoading: false,
      });
      return suggestions;
    }
  },

  saveAutocomplete: async (suggestions) => {
    const normalizedSuggestions = normalizeEditableSuggestions(suggestions);

    try {
      const response = await fetch(`${API_BASE}/api/autocomplete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sugestoes: normalizedSuggestions }),
      });
      const result = await readJsonResponse(response);
      const savedSuggestions = normalizeSuggestions(result.sugestoes || result.autocomplete || normalizedSuggestions);

      set({
        autocompleteSuggestions: savedSuggestions,
      });
      toast.success('Banco de autocompletar salvo.');
      return savedSuggestions;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar autocompletar.';
      toast.error(message);
      return null;
    }
  },

  rememberAutocompleteValue: (field, value) => {
    const cleanValue = String(value || '').trim();
    if (!field || cleanValue.length < 2) return;

    set((state) => {
      const currentValues = state.autocompleteSuggestions[field] || [];
      const exists = currentValues.some((item) => normalizeColumnName(item) === normalizeColumnName(cleanValue));
      if (exists) return {};

      return {
        autocompleteSuggestions: {
          ...state.autocompleteSuggestions,
          [field]: [...currentValues, cleanValue].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        },
      };
    });
  },

  handleTaskEvent: (event) => {
    const status = event?.status;
    const taskId = event?.task_id || null;

    if (status === 'processing') {
      set({
        currentTaskId: taskId,
        isProcessing: true,
        generationResult: null,
        statusMessage: event.message || 'Geração em processamento no worker isolado...',
      });
      return;
    }

    if (status === 'completed') {
      const result = event.result || {
        status: 'sucesso',
        mensagem: event.message || 'Orçamento finalizado com sucesso.',
        caminho_excel: event.caminho_excel || event.file_url,
        caminho_pdf: event.caminho_pdf,
      };

      toast.success('Orçamento finalizado com sucesso.');
      set({
        currentTaskId: taskId,
        isProcessing: false,
        progress: 100,
        generationResult: result,
        statusMessage: 'Orçamento finalizado com sucesso.',
      });
      return;
    }

    if (status === 'failed') {
      const message = event.error || event.message || 'Falha ao gerar orçamento.';
      toast.error(message);
      set((current) => ({
        currentTaskId: taskId,
        isProcessing: false,
        generationResult: null,
        logs: [...current.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
    }
  },

  fetchProfiles: async () => {
    set({ profilesLoading: true, profilesError: '' });

    try {
      const response = await fetch(`${API_BASE}/api/perfis`);
      const result = await readJsonResponse(response);
      const profiles = Array.isArray(result.perfis) ? result.perfis : [];

      set((state) => {
        const currentStillExists = profiles.some((profile) => profile.id === state.configData.perfil_id);
        const nextProfileId = currentStillExists ? state.configData.perfil_id : '';

        return {
          profiles,
          profilesLoading: false,
          configData: {
            ...state.configData,
            perfil_id: nextProfileId,
            modelo: nextProfileId,
          },
        };
      });
    } catch (error) {
      set({
        profilesLoading: false,
        profilesError: error instanceof Error ? error.message : 'Erro inesperado ao carregar perfis.',
      });
    }
  },

  saveProfile: async ({ file, profile }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('perfil', JSON.stringify(profile));

    const response = await fetch(`${API_BASE}/api/perfis`, {
      method: 'POST',
      body: formData,
    });
    const result = await readJsonResponse(response);
    const profiles = Array.isArray(result.perfis) ? result.perfis : [];

    set((state) => ({
      profiles,
      configData: {
        ...state.configData,
        perfil_id: result.perfil?.id || state.configData.perfil_id,
        modelo: result.perfil?.id || state.configData.modelo,
      },
    }));

    return result;
  },

  saveProfileFromTemplatePath: async (profile) => {
    const response = await fetch(`${API_BASE}/api/perfis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const result = await readJsonResponse(response);
    const profiles = Array.isArray(result.perfis) ? result.perfis : [];

    set((state) => ({
      profiles,
      configData: {
        ...state.configData,
        perfil_id: result.perfil?.id || state.configData.perfil_id,
        modelo: result.perfil?.id || state.configData.modelo,
      },
    }));

    return result;
  },

  deleteProfile: async (profileId) => {
    const response = await fetch(`${API_BASE}/api/perfis/${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
    const result = await readJsonResponse(response);
    const profiles = Array.isArray(result.perfis) ? result.perfis : [];

    set((state) => {
      const currentStillExists = profiles.some((profile) => profile.id === state.configData.perfil_id);
      const nextProfileId = currentStillExists ? state.configData.perfil_id : '';

      return {
        profiles,
        configData: {
          ...state.configData,
          perfil_id: nextProfileId,
          modelo: nextProfileId,
        },
      };
    });

    return result;
  },

  extractText: async (text) => {
    if (!text.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/extrair-texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: text }),
      });
      const data = await readJsonResponse(response);

      set((state) => ({
        formData: { ...state.formData, ...data },
        logs: [...state.logs, buildLog('Dados do texto importados para o formulário.', 'SUCCESS')],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao extrair dados do texto.';
      toast.error(message);
      set((state) => ({
        logs: [...state.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
    }
  },

  uploadExcel: async (file) => {
    const extension = getFileExtension(file.name);
    if (!SUPPORTED_EXCEL_EXTENSIONS.includes(extension)) {
      set({ uploadError: 'Use um arquivo .xlsx, .xls ou .xlsm.' });
      return;
    }

    set({
      isUploadingExcel: true,
      uploadError: '',
      excelReadError: '',
      excelReadStatus: 'loading',
      excelFileName: file.name,
      excelInfo: {},
      tableData: [],
      generationResult: null,
      currentTaskId: null,
      statusMessage: `Lendo dados de ${file.name}...`,
    });

    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);

      const uploadResponse = await fetch(`${API_BASE}/api/upload-excel`, {
        method: 'POST',
        body: uploadForm,
      });
      const uploadResult = await readJsonResponse(uploadResponse);

      if (!uploadResult.caminho) {
        throw new Error('O backend não retornou o caminho do arquivo salvo.');
      }

      const readResponse = await fetch(`${API_BASE}/api/ler-excel?caminho=${encodeURIComponent(uploadResult.caminho)}`);
      const readResult = await readJsonResponse(readResponse);
      const records = Array.isArray(readResult.dados) ? readResult.dados : [];
      const mapping = readResult.mapeamento_sugerido || inferColumnMapping(records);
      const excelInfo = readResult.info && typeof readResult.info === 'object' ? readResult.info : {};
      const message = records.length
        ? `${records.length} linhas carregadas de ${file.name}.`
        : `${file.name} foi lido, mas não possui linhas de dados.`;

      set((state) => ({
        excelPath: uploadResult.caminho,
        excelFileName: file.name,
        excelInfo,
        tableData: records,
        excelReadStatus: 'success',
        isUploadingExcel: false,
        configData: { ...state.configData, mapeamento: mapping },
        logs: [...state.logs, buildLog(message, records.length ? 'SUCCESS' : 'WARNING')],
        statusMessage: message,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao ler o Excel.';
      set((state) => ({
        tableData: [],
        excelInfo: {},
        excelReadStatus: 'error',
        excelReadError: message,
        uploadError: message,
        isUploadingExcel: false,
        logs: [...state.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
    }
  },

  clearFile: () => set((state) => ({
    excelPath: null,
    excelFileName: '',
    excelInfo: {},
    excelReadStatus: 'idle',
    excelReadError: '',
    uploadError: '',
    tableData: [],
    generationResult: null,
    currentTaskId: null,
    configData: { ...state.configData, mapeamento: {} },
    statusMessage: 'Arquivo removido. Faça upload de uma planilha para continuar.',
  })),

  generateBudget: async () => {
    const state = get();

    if (state.excelReadStatus === 'loading') {
      const message = 'Aguarde a leitura do Excel terminar antes de gerar.';
      toast.error(message);
      get().appendLog(message, 'WARNING');
      return null;
    }

    if (!state.tableData.length) {
      const message = 'Nenhum dado do Excel carregado. Faça upload de uma planilha válida antes de gerar.';
      set((current) => ({
        logs: [...current.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
      toast.error(message);
      return null;
    }

    if (!state.configData.perfil_id) {
      const message = 'Selecione ou cadastre um perfil de empresa antes de gerar.';
      set((current) => ({
        logs: [...current.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
      toast.error(message);
      return null;
    }

    if (!String(state.configData.bdi || '').trim()) {
      const message = 'Preencha o BDI antes de gerar.';
      set((current) => ({
        logs: [...current.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
      toast.error(message);
      return null;
    }

    set({
      isProcessing: true,
      generationResult: null,
      currentTaskId: null,
      logs: [],
      progress: 0,
      statusMessage: 'Iniciando geração do orçamento...',
    });

    const payload = {
      table_data: state.tableData,
      mapping: state.configData.mapeamento || inferColumnMapping(state.tableData),
      side_data: state.formData,
      config_data: { ...state.configData, ...(state.excelInfo || {}) },
      caminho_sintetico: state.excelPath,
    };

    try {
      const response = await fetch(`${API_BASE}/api/gerar-orcamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response);

      if (!result.task_id) {
        throw new Error('O backend não retornou o identificador da tarefa.');
      }

      set((current) => {
        const taskAlreadyFinished = current.currentTaskId === result.task_id && current.generationResult;
        return {
          currentTaskId: result.task_id,
          isProcessing: taskAlreadyFinished ? false : true,
          logs: [...current.logs, buildLog(result.message || 'Tarefa enviada para processamento.', 'INFO')],
          statusMessage: taskAlreadyFinished
            ? current.statusMessage
            : result.message || 'Tarefa enviada para processamento.',
        };
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro de rede ao gerar orçamento.';
      toast.error(message);
      set((current) => ({
        isProcessing: false,
        currentTaskId: null,
        logs: [...current.logs, buildLog(message, 'ERROR')],
        statusMessage: message,
      }));
      return null;
    }
  },

  openOutputFolder: async () => {
    const result = get().generationResult;
    if (!result?.caminho_excel) return;
    await fetch(`${API_BASE}/api/abrir-pasta?caminho=${encodeURIComponent(result.caminho_excel)}`);
  },

  sendWhatsApp: () => {
    const { formData } = get();
    const processNumber = formData.processo || '[Número]';
    const sector = formData.setor || '[Setor]';
    const text = `Olá, segue o orçamento do Processo ${processNumber} referente ao setor ${sector}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  },
}));
