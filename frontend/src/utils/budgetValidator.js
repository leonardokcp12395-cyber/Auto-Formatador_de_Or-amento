function parseBdi(value) {
  if (value === null || value === undefined) return null;

  const rawValue = String(value).replace('%', '').replace(',', '.').trim();
  if (!rawValue) return null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBlank(value) {
  return !String(value || '').trim();
}

export function validateBudget(formData = {}, configData = {}, tableData = []) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(tableData) || tableData.length === 0) {
    errors.push({
      field: 'tableData',
      message: 'Nenhum dado do Orçafascio foi carregado.',
    });
  }

  if (isBlank(configData.perfil_id || configData.modelo)) {
    errors.push({
      field: 'perfil_id',
      message: 'Escolha um Modelo antes de gerar.',
    });
  }

  const processo = String(formData.processo || '').trim();
  const processoDigits = processo.replace(/\D/g, '');
  if (isBlank(processo) || processoDigits.length < 8) {
    warnings.push({
      field: 'processo',
      message: 'O número do Processo SEI parece inválido.',
    });
  }

  const bdi = parseBdi(configData.bdi);
  if (bdi === null || bdi <= 0) {
    errors.push({
      field: 'bdi',
      message: 'BDI não foi preenchido.',
    });
  }

  if (isBlank(formData.data)) {
    warnings.push({
      field: 'data',
      message: 'A data de elaboração não foi preenchida.',
    });
  }

  return {
    isValid: errors.length === 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
  };
}
