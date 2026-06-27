import { useEffect, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';

let tourAlreadyRun = false;

const steps = [
  {
    target: '[data-tour="dropzone"]',
    title: 'Comece pelo Sintético',
    content: 'Arraste o seu ficheiro Sintético do Orçafascio para aqui, ou clique em selecionar arquivo.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="whatsapp-input"]',
    title: 'Preenchimento rápido',
    content: 'Cole a mensagem do WhatsApp para preencher os dados da obra com menos digitação.',
  },
  {
    target: '[data-tour="config-panel"]',
    title: 'Modelo e BDI',
    content: 'Escolha o modelo da empresa e o BDI antes de gerar. Esses campos bloqueiam erros por desatenção.',
  },
  {
    target: '[data-tour="generate-button"]',
    title: 'Gerar orçamento',
    content: 'Clique aqui para gerar o arquivo. Atalho: Ctrl + Enter.',
  },
];

export default function OnboardingTour({ replayKey = 0 }) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (tourAlreadyRun || localStorage.getItem('hasSeenTour') === 'true') {
      const timer = window.setTimeout(() => setRun(false), 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setRun(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (replayKey > 0) {
      const timer = window.setTimeout(() => setRun(true), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [replayKey]);

  const handleJoyrideCallback = (data) => {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(data.status)) {
      localStorage.setItem('hasSeenTour', 'true');
      tourAlreadyRun = true;
      setRun(false);
    }
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      showProgress
      showSkipButton
      disableOverlayClose
      scrollToFirstStep
      callback={handleJoyrideCallback}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Concluir',
        next: 'Próximo',
        skip: 'Pular',
      }}
      styles={{
        options: {
          arrowColor: '#e0f2fe',
          backgroundColor: '#e0f2fe',
          overlayColor: 'rgba(2, 6, 23, 0.78)',
          primaryColor: '#2563EB',
          textColor: '#1e293b',
          zIndex: 1200,
        },
        tooltip: {
          backgroundColor: '#e0f2fe',
          border: '1px solid rgba(37, 99, 235, 0.35)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.48)',
          color: '#1e293b',
        },
        tooltipTitle: {
          color: '#0f172a',
          fontSize: 17,
          fontWeight: 900,
        },
        tooltipContent: {
          color: '#1e293b',
          fontSize: 14,
          lineHeight: 1.55,
          padding: '10px 0 8px',
        },
        buttonNext: {
          backgroundColor: '#2563EB',
          borderRadius: 10,
          color: '#ffffff',
          fontWeight: 800,
          padding: '9px 14px',
        },
        buttonBack: {
          color: '#1D4ED8',
          marginRight: 8,
        },
        buttonSkip: {
          color: '#475569',
          fontWeight: 700,
        },
        buttonClose: {
          color: '#1e293b',
        },
        spotlight: {
          borderRadius: 14,
        },
      }}
    />
  );
}
