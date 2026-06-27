# Planify V5

Planify V5 é um aplicativo desktop híbrido para transformar o Sintético do Orçafascio em orçamentos formatados em templates Excel de empresas terceirizadas.

O fluxo principal é:

1. Upload do Sintético Excel do Orçafascio.
2. Leitura e preview da tabela no React.
3. Extração opcional dos dados da obra a partir de texto/WhatsApp.
4. Escolha de perfil de empresa e BDI.
5. Geração do Excel final em worker isolado.

## Arquitetura

- Frontend: React, Vite, Tailwind, Zustand, react-hot-toast e react-joyride.
- Backend: FastAPI, SQLAlchemy, Pandas, OpenPyXL e multiprocessing.
- Desktop: PyWebView com build via PyInstaller.
- Persistência local: `%LOCALAPPDATA%/Planify` no executável e a raiz do projeto em desenvolvimento.

## Recursos Principais

- Leitura de `.xlsx`, `.xls` e `.xlsm`.
- Suporte ao `.xls` falso do Orçafascio, que é HTML salvo com extensão de Excel.
- Preview seguro com limite de linhas para não travar o DOM.
- Universal Mapper com perfis de empresa persistidos.
- Banco de autocompletar editável para fiscais, elaboradores, estagiários e setores.
- Worker isolado para geração do orçamento, reduzindo risco de travar o servidor FastAPI.
- Logs, toasts, tour interativo e atalhos globais.
- Build Windows automatizado via GitHub Actions.

## Rodando em Desenvolvimento

Requisitos:

- Python 3.12+
- Node.js 18+

Instale as dependências:

```bash
python -m pip install -r requirements.txt
cd frontend
npm install
```

Rode o frontend:

```bash
cd frontend
npm run dev
```

Rode o backend em outro terminal:

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Rode o app desktop:

```bash
python app.py
```

## Validação

Backend:

```bash
python -m pytest -q
python -m py_compile server.py core/excel_handler.py core/worker.py utils/smart_parser.py
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Build do Executável

O build atual não usa PyArmor. O fluxo é:

1. Compilar o frontend Vite.
2. Empacotar o desktop com PyInstaller usando `PlanifyV5.spec`.

Comando:

```bash
python build_desktop.py
```

Saída esperada:

```text
dist/PlanifyV5/PlanifyV5.exe
```

## Dados Locais

Em produção, os dados editáveis ficam em:

```text
%LOCALAPPDATA%/Planify
```

Principais arquivos e pastas:

- `planify_history.db`: histórico, perfis e preferências.
- `config/autocomplete.json`: listas de autocompletar.
- `config/templates/`: templates importados.
- `logs/crash.log`: falhas não tratadas do backend.
- `Output/`: fallback para arquivos gerados.

## Atalhos

- `Ctrl + Enter`: gerar orçamento.
- `Ctrl + L`: limpar formulário.
- `Ctrl + H`: abrir o tour interativo.

## Troubleshooting

### O Excel diz que formato e extensão não correspondem

Isso é esperado em alguns exports do Orçafascio. O arquivo `.xls` pode ser HTML por dentro. O backend tenta ler como Excel real e, se falhar, interpreta como HTML.

### O executável não abre ou abre várias instâncias

Verifique se `app.py` continua chamando `multiprocessing.freeze_support()` dentro de `if __name__ == "__main__":`. Isso é obrigatório para PyInstaller com multiprocessing no Windows.

### O PDF sai cortado

O motor ajusta a planilha para largura de uma página. Se ainda cortar, revise o template usado no perfil da empresa, especialmente área de impressão e colunas muito largas.

### O perfil ou autocomplete não aparece

Abra o Hub de Configurações e salve novamente os dados. Em caso de arquivo local corrompido, confira `%LOCALAPPDATA%/Planify/config`.
