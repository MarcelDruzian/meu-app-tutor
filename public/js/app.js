// ==========================================================
// TUTOR IA - CONTROLADOR PRINCIPAL DA APLICAÇÃO (SPA)
// ==========================================================

import { TutorService } from './services/tutor.js';
import { StorageService } from './services/storage.js';
import { SpeechService } from './services/speech.js';
import { AuthService } from './services/auth.js';

// Estado Global da Sessão Atual
const state = {
  currentScreen: 'screenWelcome',
  format: 'text',
  quickQuestion: '',
  course: '',
  subject: '',
  topic: '',
  specificQuestion: '',
  currentExplanation: null,
  currentQuiz: null,
  quizCurrentIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  isAudioPlaying: false
};

// ==========================================================
// NAVEGAÇÃO ENTRE TELAS
// ==========================================================
export function switchScreen(targetScreenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('active');
  });

  const target = document.getElementById(targetScreenId);
  if (target) {
    target.classList.add('active');
    state.currentScreen = targetScreenId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateBottomNavState(targetScreenId);
  }

  // Ações contextuais ao abrir certas telas
  if (targetScreenId === 'screenHistory') {
    renderHistoryScreen();
  } else if (targetScreenId === 'screenAccount') {
    renderAccountScreen();
  }
}

function updateBottomNavState(screenId) {
  const navButtons = document.querySelectorAll('.nav-tab-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));

  if (screenId === 'screenWelcome') {
    document.getElementById('navHome')?.classList.add('active');
  } else if (['screenFormat', 'screenStudyInfo', 'screenResult'].includes(screenId)) {
    document.getElementById('navStudy')?.classList.add('active');
  } else if (screenId === 'screenQuiz') {
    document.getElementById('navQuiz')?.classList.add('active');
  } else if (screenId === 'screenHistory') {
    document.getElementById('navHistory')?.classList.add('active');
  } else if (screenId === 'screenAccount') {
    document.getElementById('navAccount')?.classList.add('active');
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    const isDark = normalizedTheme === 'dark';
    toggleBtn.setAttribute('aria-pressed', String(isDark));
    toggleBtn.setAttribute('aria-label', isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro');
    const icon = toggleBtn.querySelector('.theme-toggle-icon');
    const text = toggleBtn.querySelector('.theme-toggle-text');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (text) text.textContent = isDark ? 'Modo claro' : 'Modo escuro';
  }
  localStorage.setItem('tutor-theme', normalizedTheme);
}

function initThemeToggle() {
  const savedTheme = localStorage.getItem('tutor-theme');
  const preferredTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light';
  applyTheme(preferredTheme);

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

// ==========================================================
// SISTEMA DE NOTIFICAÇÕES (TOASTS)
// ==========================================================
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'warning') icon = '🔔';

  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span>${icon}</span>
      <span>${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function ensureAuthenticatedAccess(actionLabel = 'pesquisar conteúdo') {
  const isAuthenticated = StorageService.isAuthenticated();
  if (!isAuthenticated) {
    showToast(`Para ${actionLabel}, faça login com sua conta primeiro.`, 'warning', 4200);
    switchScreen('screenAccount');
    return false;
  }
  return true;
}

// ==========================================================
// TELA 2: ESCOLHA DO FORMATO DE APRENDIZAGEM
// ==========================================================
function initFormatSelection() {
  const formatCards = document.querySelectorAll('.format-card');
  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      formatCards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        state.format = radio.value;
      }
    });
  });

  formatCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    const isSelected = radio?.checked;
    card.setAttribute('aria-pressed', String(Boolean(isSelected)));
  });

  document.getElementById('btnStartResearch')?.addEventListener('click', () => {
    switchScreen('screenFormat');
  });

  document.getElementById('btnBackToWelcome')?.addEventListener('click', () => {
    switchScreen('screenWelcome');
  });

  document.getElementById('btnContinueToDetails')?.addEventListener('click', () => {
    const quickQ = document.getElementById('inputQuickQuestion')?.value.trim();
    if (quickQ) {
      state.quickQuestion = quickQ;
      // Preenche como dúvida inicial no próximo passo
      const specificField = document.getElementById('inputSpecificQuestion');
      if (specificField && !specificField.value) {
        specificField.value = quickQ;
      }
    }
    switchScreen('screenStudyInfo');
  });
}

// ==========================================================
// TELA 3: INFORMAÇÕES DO ESTUDO E MICROFONE
// ==========================================================
function initStudyInfoForm() {
  const courseInput = document.getElementById('inputCourse');
  const subjectInput = document.getElementById('inputSubject');
  const topicInput = document.getElementById('inputTopic');
  const specificQInput = document.getElementById('inputSpecificQuestion');

  // Pílulas de preenchimento rápido
  document.querySelectorAll('.quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetId = pill.dataset.target;
      const targetVal = pill.dataset.val;
      const inputEl = document.getElementById(targetId);
      if (inputEl) {
        inputEl.value = targetVal;
        inputEl.classList.remove('input-error');
        const errEl = document.getElementById(targetId.replace('input', 'err'));
        if (errEl) errEl.classList.remove('visible');
      }
    });
  });

  // Microfone / Reconhecimento de Voz (Web Speech API)
  const micBtn = document.getElementById('btnMicRecord');
  const micIcon = document.getElementById('micIcon');
  const micBtnText = document.getElementById('micBtnText');
  const micStatusText = document.getElementById('micStatusText');

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (SpeechService.isListening) {
        SpeechService.stopVoiceRecognition();
        return;
      }

      const started = SpeechService.startVoiceRecognition({
        onStart: () => {
          micBtn.classList.add('listening');
          if (micIcon) micIcon.textContent = '🔴';
          if (micBtnText) micBtnText.textContent = 'Ouvindo...';
          if (micStatusText) micStatusText.textContent = 'Fale agora a sua dúvida no microfone...';
        },
        onResult: (transcript) => {
          if (specificQInput) {
            specificQInput.value = specificQInput.value 
              ? `${specificQInput.value} ${transcript}` 
              : transcript;
            showToast('Voz transcrita com sucesso!', 'success');
          }
        },
        onError: (errMsg) => {
          showToast(errMsg, 'warning');
        },
        onEnd: () => {
          micBtn.classList.remove('listening');
          if (micIcon) micIcon.textContent = '🎙️';
          if (micBtnText) micBtnText.textContent = 'Falar por voz';
          if (micStatusText) micStatusText.textContent = 'Clique no microfone para ditar';
        }
      });

      if (!started && !SpeechService.isVoiceRecognitionSupported()) {
        showToast('Navegador sem suporte ao microfone. Você pode digitar normalmente!', 'warning');
      }
    });
  }

  // Voltar para a tela de formato
  document.getElementById('btnBackToFormat')?.addEventListener('click', () => {
    switchScreen('screenFormat');
  });

  // Submissão da Pesquisa
  document.getElementById('btnSubmitSearch')?.addEventListener('click', async () => {
    if (!ensureAuthenticatedAccess('pesquisar conteúdo')) {
      return;
    }

    const course = courseInput?.value.trim();
    const subject = subjectInput?.value.trim();
    const topic = topicInput?.value.trim();
    const specificQuestion = specificQInput?.value.trim();

    let hasError = false;

    // Validação dos campos obrigatórios
    if (!course) {
      courseInput?.classList.add('input-error');
      document.getElementById('errCourse')?.classList.add('visible');
      hasError = true;
    } else {
      courseInput?.classList.remove('input-error');
      document.getElementById('errCourse')?.classList.remove('visible');
    }

    if (!subject) {
      subjectInput?.classList.add('input-error');
      document.getElementById('errSubject')?.classList.add('visible');
      hasError = true;
    } else {
      subjectInput?.classList.remove('input-error');
      document.getElementById('errSubject')?.classList.remove('visible');
    }

    if (!topic) {
      topicInput?.classList.add('input-error');
      document.getElementById('errTopic')?.classList.add('visible');
      hasError = true;
    } else {
      topicInput?.classList.remove('input-error');
      document.getElementById('errTopic')?.classList.remove('visible');
    }

    if (hasError) {
      showToast('Preencha os campos obrigatórios assinalados.', 'error');
      return;
    }

    // Atualiza estado
    state.course = course;
    state.subject = subject;
    state.topic = topic;
    state.specificQuestion = specificQuestion;

    // Estado de carregamento
    const btnSubmit = document.getElementById('btnSubmitSearch');
    const spinner = document.getElementById('searchSpinner');
    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
      showToast('Consultando o Tutor IA...', 'info', 2000);
      const result = await TutorService.requestExplanation({
        course,
        subject,
        topic,
        question: specificQuestion,
        format: state.format
      });

      state.currentExplanation = result.explanation;

      // Salva a sessão no histórico local
      StorageService.saveStudySession({
        course,
        subject,
        topic,
        question: specificQuestion,
        format: state.format,
        summary: result.explanation.summary
      });

      // Renderiza os dados na Tela 4
      renderResultScreen(result.explanation, result.meta);
      switchScreen('screenResult');
      if (result.meta && !result.meta.isDemo) {
        showToast(`Conteúdo gerado com IA (${result.meta.provider || 'Tempo Real'})!`, 'success');
      } else {
        showToast('Conteúdo preparado com sucesso!', 'success');
      }
    } catch (err) {
      showToast('Ocorreu um erro ao gerar a explicação: ' + err.message, 'error');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  });
}

// ==========================================================
// TELA 4: RENDERIZAR RESULTADO DO TUTOR E ÁUDIO
// ==========================================================
function renderResultScreen(explanation, meta = {}) {
  // Badges e títulos
  document.getElementById('badgeCourse').textContent = state.course || 'Curso';
  document.getElementById('badgeSubject').textContent = state.subject || 'Disciplina';
  
  const formatNames = { text: 'Texto', video: 'Vídeo', audio: 'Áudio' };
  document.getElementById('badgeFormat').textContent = `Formato: ${formatNames[state.format] || 'Texto'}`;

  document.getElementById('resultTitle').textContent = explanation.title || `${state.topic} em ${state.subject}`;
  document.getElementById('resultSubtitle').textContent = explanation.subtitle || explanation.summary;

  // Banner Dinâmico: IA Real vs Modo Demonstração
  const banner = document.getElementById('resultStatusBanner');
  const bannerIcon = document.getElementById('resultStatusIcon');
  const bannerTitle = document.getElementById('resultStatusTitle');
  const bannerNotice = document.getElementById('resultStatusNotice');

  if (meta && !meta.isDemo) {
    banner?.classList.add('ai-active');
    if (bannerIcon) bannerIcon.textContent = '🤖';
    if (bannerTitle) bannerTitle.textContent = `Inteligência Artificial Ativa (${meta.provider || 'Tempo Real'})`;
    if (bannerNotice) bannerNotice.textContent = meta.notice || 'Esta explicação foi gerada em tempo real com raciocínio personalizado para sua dúvida.';
  } else {
    banner?.classList.remove('ai-active');
    if (bannerIcon) bannerIcon.textContent = 'ℹ️';
    if (bannerTitle) bannerTitle.textContent = 'Modo de Demonstração (Etapa 2)';
    if (bannerNotice) bannerNotice.textContent = meta?.notice || 'Esta explicação foi gerada com conteúdo didático estruturado. Na Etapa 2, configure sua chave no arquivo .env para ativar a IA em tempo real.';
  }

  // Seção Conceito
  const conceptSection = explanation.sections?.find(s => s.type === 'concept');
  const conceptEl = document.getElementById('contentConcept');
  if (conceptEl && conceptSection) {
    conceptEl.innerHTML = formatMarkdownText(conceptSection.content);
  }

  // Seção Passo a Passo
  const stepsSection = explanation.sections?.find(s => s.type === 'steps');
  const stepsList = document.getElementById('contentStepsList');
  if (stepsList && stepsSection && stepsSection.items) {
    stepsList.innerHTML = stepsSection.items.map((item, idx) => `
      <li>
        <span class="step-number-bullet">${idx + 1}</span>
        ${formatMarkdownText(item)}
      </li>
    `).join('');
  }

  // Seção Exemplo
  const exampleSection = explanation.sections?.find(s => s.type === 'example');
  const exampleEl = document.getElementById('contentExample');
  if (exampleEl && exampleSection) {
    exampleEl.innerHTML = formatMarkdownText(exampleSection.content);
  }

  // Seção Resumo
  const summarySection = explanation.sections?.find(s => s.type === 'summary');
  const summaryEl = document.getElementById('contentSummary');
  if (summaryEl && summarySection) {
    summaryEl.innerHTML = formatMarkdownText(summarySection.content);
  }

  // Seção Vídeo (Exibida com prioridade se formato for vídeo)
  const videoCard = document.getElementById('videoSectionCard');
  if (state.format === 'video' && explanation.videoRecommendations?.length) {
    const videoData = explanation.videoRecommendations[0];
    videoCard.style.display = 'block';
    document.getElementById('videoTitle').textContent = videoData.title;
    document.getElementById('videoDesc').textContent = `${videoData.channel} — ${videoData.description}`;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(videoData.searchQuery || state.topic)}`;
    document.getElementById('linkSearchVideo').href = searchUrl;
  } else {
    videoCard.style.display = 'none';
  }

  // Sugestões de Perguntas para Aprofundar
  const deepenContainer = document.getElementById('deepenQuestionsList');
  if (deepenContainer && explanation.followUpQuestions) {
    deepenContainer.innerHTML = explanation.followUpQuestions.map(q => `
      <button class="deepen-question-btn" data-question="${encodeURIComponent(q)}">
        <span>❓ ${q}</span>
        <span>→</span>
      </button>
    `).join('');

    deepenContainer.querySelectorAll('.deepen-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedQ = decodeURIComponent(btn.dataset.question);
        document.getElementById('inputSpecificQuestion').value = selectedQ;
        showToast('Pergunta aplicada! Você pode pesquisar os detalhes agora.', 'info');
        switchScreen('screenStudyInfo');
      });
    });
  }

  // Se formato for áudio, avisa o usuário sobre o reprodutor
  if (state.format === 'audio') {
    document.getElementById('audioPlayerCard').style.borderColor = 'var(--color-primary)';
    showToast('Formato Áudio selecionado: você pode ouvir a explicação no player acima.', 'info', 4000);
  }
}

function initAudioControls() {
  const btnPlay = document.getElementById('btnPlaySpeech');
  const btnPause = document.getElementById('btnPauseSpeech');
  const btnStop = document.getElementById('btnStopSpeech');
  const statusLabel = document.getElementById('audioStatusLabel');

  btnPlay?.addEventListener('click', () => {
    if (SpeechService.isPaused()) {
      SpeechService.resumeSpeech();
      btnPlay.style.display = 'none';
      btnPause.style.display = 'inline-flex';
      statusLabel.textContent = 'Reproduzindo explicação em voz alta...';
      return;
    }

    const script = state.currentExplanation?.audioScript || 
      state.currentExplanation?.summary || 
      `Explicação sobre ${state.topic}.`;

    SpeechService.speakText(script, {
      onStart: () => {
        btnPlay.style.display = 'none';
        btnPause.style.display = 'inline-flex';
        statusLabel.textContent = 'Ouvindo o Tutor IA falar...';
        showToast('Iniciando áudio da explicação...', 'info', 2000);
      },
      onEnd: () => {
        btnPlay.style.display = 'inline-flex';
        btnPause.style.display = 'none';
        statusLabel.textContent = 'Áudio concluído com sucesso!';
      },
      onError: (err) => {
        btnPlay.style.display = 'inline-flex';
        btnPause.style.display = 'none';
        statusLabel.textContent = 'Áudio pausado ou não disponível neste navegador.';
        showToast(err, 'warning');
      }
    });
  });

  btnPause?.addEventListener('click', () => {
    SpeechService.pauseSpeech();
    btnPlay.style.display = 'inline-flex';
    btnPause.style.display = 'none';
    statusLabel.textContent = 'Áudio pausado. Toque em Play para continuar.';
  });

  btnStop?.addEventListener('click', () => {
    SpeechService.stopSpeech();
    btnPlay.style.display = 'inline-flex';
    btnPause.style.display = 'none';
    statusLabel.textContent = 'Áudio interrompido.';
  });

  // Botão Ver Mais Detalhes
  document.getElementById('btnToggleSeeMore')?.addEventListener('click', () => {
    const extraCard = document.getElementById('extraDetailsCard');
    const btn = document.getElementById('btnToggleSeeMore');
    if (extraCard.style.display === 'none') {
      extraCard.style.display = 'block';
      btn.textContent = '📖 Ocultar detalhes extras';
    } else {
      extraCard.style.display = 'none';
      btn.textContent = '📖 Ver mais detalhes';
    }
  });

  // Botão Fazer Outra Pergunta
  document.getElementById('btnNewSearch')?.addEventListener('click', () => {
    SpeechService.stopSpeech();
    switchScreen('screenStudyInfo');
  });

  // Botão Ir para Quiz
  document.getElementById('btnGoToQuiz')?.addEventListener('click', async () => {
    if (!ensureAuthenticatedAccess('gerar questionários')) {
      return;
    }

    SpeechService.stopSpeech();
    await startQuizForCurrentTopic();
  });
}

// ==========================================================
// TELA 5: EXERCÍCIOS E QUESTIONÁRIOS INTERATIVOS
// ==========================================================
async function startQuizForCurrentTopic() {
  if (!ensureAuthenticatedAccess('gerar questionários')) {
    return;
  }

  if (!state.topic) {
    state.course = 'Ensino Médio';
    state.subject = 'Física';
    state.topic = 'Leis de Newton';
  }

  showToast('Carregando questionário com o Tutor IA...', 'info', 2000);
  
  // Monta o contexto textual completo que o estudante acabou de ler
  let explanationContext = '';
  if (state.currentExplanation) {
    const exp = state.currentExplanation;
    explanationContext = `Título: ${exp.title}\nResumo: ${exp.summary}\n`;
    if (exp.sections) {
      explanationContext += exp.sections.map(s => `${s.title}:\n${s.content || (s.items ? s.items.join('\n') : '')}`).join('\n\n');
    }
  }

  const quizData = await TutorService.requestQuiz({
    course: state.course,
    subject: state.subject,
    topic: state.topic,
    explanationContext
  });

  if (quizData.meta && !quizData.meta.isDemo) {
    showToast(`Simulado gerado por IA (${quizData.meta.provider || 'Tempo Real'})!`, 'success');
  }

  state.currentQuiz = quizData.questions || [];
  state.quizCurrentIndex = 0;
  state.quizScore = 0;
  state.quizAnswered = false;

  document.getElementById('quizSubtitle').textContent = 
    `Questões comentadas sobre ${state.topic} (${state.subject})`;

  document.getElementById('quizProgressCard').style.display = 'block';
  document.getElementById('activeQuestionCard').style.display = 'block';
  document.getElementById('quizResultSummaryCard').style.display = 'none';

  renderCurrentQuizQuestion();
  switchScreen('screenQuiz');
}

function renderCurrentQuizQuestion() {
  const currentQ = state.currentQuiz[state.quizCurrentIndex];
  if (!currentQ) return;

  state.quizAnswered = false;

  const total = state.currentQuiz.length;
  const currentStep = state.quizCurrentIndex + 1;
  const pct = Math.round((currentStep / total) * 100);

  document.getElementById('quizCurrentStepText').textContent = `Questão ${currentStep} de ${total}`;
  document.getElementById('quizScorePreviewText').textContent = `Acertos: ${state.quizScore}`;
  document.getElementById('quizProgressBarFill').style.width = `${pct}%`;

  document.getElementById('questionPill').textContent = `Questão ${currentStep}`;
  document.getElementById('questionStatementText').textContent = currentQ.statement;

  // Renderizar alternativas
  const container = document.getElementById('quizOptionsContainer');
  container.innerHTML = currentQ.options.map(opt => `
    <button class="quiz-option-btn" data-opt-id="${opt.id}">
      <span class="option-badge">${opt.id}</span>
      <span class="option-text-content">${opt.text}</span>
    </button>
  `).join('');

  // Esconder feedback e botão próxima
  const feedbackBox = document.getElementById('questionFeedbackBox');
  feedbackBox.className = 'question-feedback-box';
  feedbackBox.style.display = 'none';

  const btnNext = document.getElementById('btnNextQuestion');
  btnNext.style.display = 'none';

  // Configurar cliques nas opções
  container.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.quizAnswered) return;
      handleOptionSelected(btn.dataset.optId, currentQ);
    });
  });
}

function handleOptionSelected(selectedId, question) {
  state.quizAnswered = true;
  const selectedOpt = question.options.find(o => o.id === selectedId);
  const correctOpt = question.options.find(o => o.isCorrect);

  const container = document.getElementById('quizOptionsContainer');
  const allBtns = container.querySelectorAll('.quiz-option-btn');

  allBtns.forEach(b => {
    b.disabled = true;
    const optId = b.dataset.optId;
    if (optId === selectedId) {
      if (selectedOpt.isCorrect) {
        b.classList.add('correct-answered');
      } else {
        b.classList.add('incorrect-answered');
      }
    }
    if (optId === correctOpt.id && !selectedOpt.isCorrect) {
      b.classList.add('correct-answered');
    }
  });

  const feedbackBox = document.getElementById('questionFeedbackBox');
  const feedbackTitle = document.getElementById('feedbackTitle');
  const feedbackText = document.getElementById('feedbackText');

  if (selectedOpt.isCorrect) {
    state.quizScore += 1;
    feedbackBox.className = 'question-feedback-box visible feedback-success';
    feedbackTitle.textContent = '🎉 Resposta Correta!';
    feedbackText.textContent = selectedOpt.feedback || 'Você acertou o raciocínio deste conceito!';
  } else {
    feedbackBox.className = 'question-feedback-box visible feedback-danger';
    feedbackTitle.textContent = '❌ Resposta Incorreta';
    feedbackText.textContent = `${selectedOpt.feedback} Alternativa correta: ${correctOpt.id}. ${correctOpt.feedback}`;
  }

  feedbackBox.style.display = 'block';

  // Atualiza placar
  document.getElementById('quizScorePreviewText').textContent = `Acertos: ${state.quizScore}`;

  // Botão avançar
  const btnNext = document.getElementById('btnNextQuestion');
  const isLast = state.quizCurrentIndex === state.currentQuiz.length - 1;
  btnNext.textContent = isLast ? '🏁 Ver resultado final' : 'Próxima questão →';
  btnNext.style.display = 'block';
}

function initQuizNavigation() {
  document.getElementById('btnNextQuestion')?.addEventListener('click', () => {
    if (state.quizCurrentIndex < state.currentQuiz.length - 1) {
      state.quizCurrentIndex += 1;
      renderCurrentQuizQuestion();
    } else {
      finishQuiz();
    }
  });

  document.getElementById('btnRetryQuiz')?.addEventListener('click', () => {
    state.quizCurrentIndex = 0;
    state.quizScore = 0;
    state.quizAnswered = false;
    document.getElementById('quizProgressCard').style.display = 'block';
    document.getElementById('activeQuestionCard').style.display = 'block';
    document.getElementById('quizResultSummaryCard').style.display = 'none';
    renderCurrentQuizQuestion();
  });

  document.getElementById('btnBackToResultFromQuiz')?.addEventListener('click', () => {
    switchScreen('screenResult');
  });
}

function finishQuiz() {
  document.getElementById('quizProgressCard').style.display = 'none';
  document.getElementById('activeQuestionCard').style.display = 'none';

  const summaryCard = document.getElementById('quizResultSummaryCard');
  summaryCard.style.display = 'block';

  const total = state.currentQuiz.length;
  const score = state.quizScore;
  const pct = Math.round((score / total) * 100);

  document.getElementById('finalScoreNumber').textContent = `${pct}%`;
  document.getElementById('finalScoreFraction').textContent = `${score} de ${total} acertos`;

  const headline = document.getElementById('finalScoreHeadline');
  const msg = document.getElementById('finalScoreMessage');

  if (pct === 100) {
    headline.textContent = '🌟 Desempenho Impecável!';
    msg.textContent = 'Você gabaritou o questionário e dominou todos os conceitos essenciais deste tópico!';
  } else if (pct >= 60) {
    headline.textContent = '👏 Bom Trabalho!';
    msg.textContent = 'Você teve um ótimo aproveitamento. Revise os pontos onde teve dúvida para fixar 100%.';
  } else {
    headline.textContent = '💪 Continue Praticando!';
    msg.textContent = 'O erro faz parte do aprendizado. Leia novamente o resumo do Tutor IA e tente mais uma vez.';
  }

  // Salvar no histórico
  StorageService.saveQuizResult({
    topic: state.topic,
    subject: state.subject,
    score: score,
    total: total
  });

  showToast('Resultado salvo no seu progresso local!', 'success');
}

// ==========================================================
// TELA 6: HISTÓRICO E PROGRESSO
// ==========================================================
function renderHistoryScreen() {
  const history = StorageService.getHistory();
  const quizzes = StorageService.getQuizzes();
  const goals = StorageService.getGoals();

  // Estatísticas
  document.getElementById('statTotalStudies').textContent = history.length;
  document.getElementById('statQuizzesDone').textContent = quizzes.length;
  document.getElementById('statStreakDays').textContent = `${goals.streak || 1}🔥`;

  // Meta diária
  const target = goals.dailyTarget || 3;
  const done = goals.completedToday || 0;
  const pct = Math.min(100, Math.round((done / target) * 100));

  document.getElementById('goalProgressLabel').textContent = `${done} de ${target} concluídos`;
  document.getElementById('goalProgressBarFill').style.width = `${pct}%`;

  // Lista de itens recentes
  const container = document.getElementById('historyListContainer');
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-history-box">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">📚</div>
        <p>Você ainda não realizou pesquisas de estudo neste navegador.</p>
        <p style="font-size: 12px; margin-top: 4px;">Inicie sua primeira pesquisa na aba <strong>Estudar</strong>!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => {
    const dateFormatted = new Date(item.date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="history-item-card" data-history-id="${item.id}">
        <div class="history-item-header">
          <span class="history-course-tag">${item.course} · ${item.subject}</span>
          <span class="history-date">${dateFormatted}</span>
        </div>
        <div class="history-title">${item.topic}</div>
        <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.3;">
          ${item.summary ? item.summary.slice(0, 110) + '...' : 'Revisão com o Tutor IA'}
        </p>
      </div>
    `;
  }).join('');

  // Clicar para reabrir estudo do histórico
  container.querySelectorAll('.history-item-card').forEach(card => {
    card.addEventListener('click', async () => {
      const histId = card.dataset.historyId;
      const item = history.find(h => h.id === histId);
      if (item) {
        state.course = item.course;
        state.subject = item.subject;
        state.topic = item.topic;
        state.specificQuestion = item.question || '';
        state.format = item.format || 'text';

        showToast(`Reabrindo estudo sobre ${item.topic}...`, 'info');
        const result = await TutorService.requestExplanation({
          course: item.course,
          subject: item.subject,
          topic: item.topic,
          question: item.question,
          format: item.format
        });
        state.currentExplanation = result.explanation;
        renderResultScreen(result.explanation);
        switchScreen('screenResult');
      }
    });
  });

  // Botão Limpar Histórico
  document.getElementById('btnClearHistory')?.addEventListener('click', () => {
    if (confirm('Deseja realmente limpar todo o histórico de estudos deste navegador?')) {
      StorageService.clearHistory();
      renderHistoryScreen();
      showToast('Histórico local removido com sucesso.', 'info');
    }
  });
}

// ==========================================================
// TELA 7: CONTA DO ESTUDANTE
// ==========================================================
function renderAccountScreen() {
  const account = StorageService.getAccount();
  const nameEl = document.getElementById('userDisplayName');
  const noticeEl = document.getElementById('userModeNotice');
  const avatarEl = document.getElementById('userAvatarIcon');
  const hasSession = Boolean(StorageService.getSessionToken());

  if (account.isGuest && !hasSession) {
    nameEl.textContent = 'Estudante Visitante';
    noticeEl.textContent = 'Modo de teste gratuito · sem cadastro';
    if (avatarEl) avatarEl.textContent = '🎓';
    return;
  }

  nameEl.textContent = account.name || 'Estudante autenticado';
  noticeEl.textContent = account.email
    ? `Conta ativa · ${account.email}`
    : 'Sessão autenticada em andamento';
  if (avatarEl) avatarEl.textContent = '✅';
}

function initAccountScreen() {
  const tabLogin = document.getElementById('tabBtnLogin');
  const tabRegister = document.getElementById('tabBtnRegister');
  const groupName = document.getElementById('groupNameRegister');
  const boxForgot = document.getElementById('boxForgotPassword');
  const btnSubmit = document.getElementById('btnSubmitAuth');

  let mode = 'login';

  tabLogin?.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    groupName.style.display = 'none';
    boxForgot.style.display = 'block';
    btnSubmit.textContent = 'Entrar na minha conta';
  });

  tabRegister?.addEventListener('click', () => {
    mode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    groupName.style.display = 'block';
    boxForgot.style.display = 'none';
    btnSubmit.textContent = 'Criar minha conta gratuita';
  });

  document.getElementById('btnSubmitAuth')?.addEventListener('click', async () => {
    const email = document.getElementById('inputAuthEmail')?.value.trim();
    const pass = document.getElementById('inputAuthPassword')?.value || '';
    const name = document.getElementById('inputAuthName')?.value.trim();

    if (!email || !pass) {
      showToast('Por favor, informe e-mail e senha.', 'error');
      return;
    }

    if (mode === 'register' && [...pass].length < 8) {
      showToast('Para criar a conta, use uma senha com pelo menos 8 caracteres.', 'warning');
      return;
    }

    try {
      const result = mode === 'register'
        ? await AuthService.register({ name: name || 'Estudante', email, password: pass })
        : await AuthService.login({ email, password: pass });

      const userData = {
        isGuest: false,
        id: result.user?.id || null,
        name: result.user?.name || (email.split('@')[0] || 'Estudante'),
        email: result.user?.email || email
      };

      StorageService.saveAccount(userData);
      StorageService.saveSessionToken(result.token || StorageService.getSessionToken());
      renderAccountScreen();
      showToast(mode === 'register'
        ? `Conta criada com sucesso! Bem-vindo(a), ${userData.name}.`
        : `Login realizado com sucesso! Bem-vindo(a), ${userData.name}.`, 'success');
    } catch (error) {
      showToast(error.message || 'Não foi possível autenticar no momento.', 'error');
    }
  });

  document.getElementById('btnContinueAsGuest')?.addEventListener('click', () => {
    StorageService.clearSessionToken();
    StorageService.saveAccount({ isGuest: true, name: 'Estudante Visitante', email: '' });
    renderAccountScreen();
    showToast('Você está utilizando o Tutor IA em modo visitante, sem cadastro.', 'info');
  });

  document.getElementById('btnForgotPassword')?.addEventListener('click', () => {
    const email = document.getElementById('inputAuthEmail')?.value.trim();
    if (!email) {
      showToast('Digite o seu e-mail para receber instruções de recuperação.', 'warning');
    } else {
      showToast(`Instruções de recuperação enviadas para ${email}.`, 'info', 4000);
    }
  });
}

// ==========================================================
// FORMATAÇÃO AUXILIAR DE TEXTO
// ==========================================================
function formatMarkdownText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ==========================================================
// VERIFICAÇÃO DO STATUS DA IA (ETAPA 2)
// ==========================================================
async function checkAndApplyApiStatus() {
  const status = await TutorService.getApiStatus();
  const pill = document.getElementById('headerStatusPill');
  const text = document.getElementById('headerStatusText');
  const hasSession = Boolean(StorageService.getSessionToken());

  if (hasSession) {
    pill?.classList.add('ai-active');
    pill?.setAttribute('title', 'Sessão autenticada ativa · Etapa 3');
    if (text) text.textContent = 'Etapa 3 · Conta ativa';
    return;
  }

  if (status.hasApiKey) {
    pill?.classList.add('ai-active');
    pill?.setAttribute('title', `IA Ativa em Tempo Real (${status.provider})`);
    if (text) text.textContent = 'IA Ativa 🤖';
  } else {
    pill?.classList.remove('ai-active');
    pill?.setAttribute('title', 'Modo Demonstração ativo: adicione a chave no arquivo .env');
    if (text) text.textContent = 'Etapa 2 · Demo';
  }
}

// ==========================================================
// INICIALIZAÇÃO GERAL DA APLICAÇÃO
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
  const currentToken = StorageService.getSessionToken();
  if (currentToken) {
    try {
      const user = await AuthService.getCurrentUser(currentToken);
      if (user) {
        StorageService.saveAccount({
          isGuest: false,
          id: user.id,
          name: user.name,
          email: user.email
        });
      }
    } catch (error) {
      console.warn('Sessão expirada ou indisponível:', error.message);
      StorageService.clearSessionToken();
      StorageService.saveAccount({ isGuest: true, name: 'Estudante Visitante', email: '' });
    }
  }

  // Logo volta para Home
  document.getElementById('btnLogoHome')?.addEventListener('click', () => {
    switchScreen('screenWelcome');
  });

  initThemeToggle();

  // Verifica status da IA
  checkAndApplyApiStatus();

  // Configuração das abas da barra de navegação inferior
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screenId = btn.dataset.screen;
      if (screenId === 'screenQuiz') {
        if (!ensureAuthenticatedAccess('acessar exercícios')) {
          return;
        }
        if (!state.currentQuiz) {
          startQuizForCurrentTopic();
          return;
        }
      }
      switchScreen(screenId);
    });
  });

  // Inicializa componentes de cada tela
  initFormatSelection();
  initStudyInfoForm();
  initAudioControls();
  initQuizNavigation();
  initAccountScreen();

  // Registrar Service Worker para PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        reg => console.log('Service Worker do Tutor IA registrado:', reg.scope),
        err => console.log('Falha ao registrar Service Worker:', err)
      );
    });
  }

  console.log('🎓 Tutor IA inicializado com sucesso na Etapa 2 (IA Conectada).');
});
