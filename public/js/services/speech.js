// ==========================================================
// TUTOR IA - SERVIÇO DE ÁUDIO E VOZ (WEB SPEECH API)
// Leitura em voz alta (TTS) e Reconhecimento de Voz (STT)
// ==========================================================

export const SpeechService = {
  recognitionInstance: null,
  isListening: false,
  synth: typeof window !== 'undefined' ? window.speechSynthesis : null,
  currentUtterance: null,

  // ========================================================
  // RECONHECIMENTO DE VOZ (Ditar dúvida pelo microfone)
  // ========================================================
  isVoiceRecognitionSupported() {
    return typeof window !== 'undefined' && 
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  startVoiceRecognition(callbacks = {}) {
    const { onResult, onError, onEnd, onStart } = callbacks;

    if (!this.isVoiceRecognitionSupported()) {
      if (onError) onError('Seu navegador não suporta reconhecimento de voz direto. Você pode digitar normalmente.');
      return false;
    }

    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognitionInstance = new SpeechRec();
      this.recognitionInstance.lang = 'pt-BR';
      this.recognitionInstance.continuous = false;
      this.recognitionInstance.interimResults = false;

      this.recognitionInstance.onstart = () => {
        this.isListening = true;
        if (onStart) onStart();
      };

      this.recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (onResult) onResult(transcript);
      };

      this.recognitionInstance.onerror = (event) => {
        this.isListening = false;
        let msg = 'Não foi possível captar a voz.';
        if (event.error === 'not-allowed') {
          msg = 'Permissão para usar o microfone foi recusada pelo navegador.';
        } else if (event.error === 'no-speech') {
          msg = 'Nenhuma fala foi detectada. Tente falar um pouco mais alto.';
        }
        if (onError) onError(msg);
      };

      this.recognitionInstance.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd();
      };

      this.recognitionInstance.start();
      return true;
    } catch (err) {
      this.isListening = false;
      if (onError) onError('Erro ao iniciar microfone: ' + err.message);
      return false;
    }
  },

  stopVoiceRecognition() {
    if (this.recognitionInstance && this.isListening) {
      try {
        this.recognitionInstance.stop();
      } catch (e) {}
    }
    this.isListening = false;
  },

  // ========================================================
  // LEITURA EM VOZ ALTA (Text-To-Speech)
  // ========================================================
  isTextToSpeechSupported() {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  },

  speakText(text, callbacks = {}) {
    const { onStart, onEnd, onError } = callbacks;

    if (!this.isTextToSpeechSupported()) {
      if (onError) onError('Seu navegador não suporta leitura em voz alta.');
      return false;
    }

    this.stopSpeech(); // Para qualquer leitura anterior

    try {
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.lang = 'pt-BR';
      this.currentUtterance.rate = 1.0;
      this.currentUtterance.pitch = 1.0;

      // Tenta selecionar voz em português se disponível
      const voices = this.synth.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt') || v.lang.startsWith('PT'));
      if (ptVoice) {
        this.currentUtterance.voice = ptVoice;
      }

      this.currentUtterance.onstart = () => {
        if (onStart) onStart();
      };

      this.currentUtterance.onend = () => {
        if (onEnd) onEnd();
      };

      this.currentUtterance.onerror = (e) => {
        if (onError) onError('Erro na leitura de áudio: ' + (e.error || 'Interrompido'));
      };

      this.synth.speak(this.currentUtterance);
      return true;
    } catch (err) {
      if (onError) onError('Erro ao reproduzir voz: ' + err.message);
      return false;
    }
  },

  pauseSpeech() {
    if (this.synth && this.synth.speaking) {
      this.synth.pause();
    }
  },

  resumeSpeech() {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  },

  stopSpeech() {
    if (this.synth) {
      this.synth.cancel();
    }
  },

  isPlaying() {
    return Boolean(this.synth && this.synth.speaking && !this.synth.paused);
  },

  isPaused() {
    return Boolean(this.synth && this.synth.paused);
  }
};
