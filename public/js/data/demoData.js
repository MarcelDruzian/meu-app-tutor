// ==========================================================
// TUTOR IA - BASE DIDÁTICA E GERADOR DE CONTEÚDO EDUCACIONAL
// ==========================================================

export function normalizeStr(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const DEMO_PRESETS = [
  // --------------------------------------------------------
  // 1. HISTÓRIA: DESCOBERTA / CHEGADA DOS PORTUGUESES AO BRASIL
  // --------------------------------------------------------
  {
    keywords: ['descoberta do brasil', 'descoberta do brasi', 'descobrimento do brasil', 'chegada dos portugueses', 'cabral', 'pero vaz de caminha', '1500', 'monte pascoal'],
    course: 'Ensino Fundamental / Médio / ENEM',
    subject: 'História',
    topic: 'Descoberta do Brasil (1500)',
    explanation: {
      title: 'A Chegada dos Portugueses ao Brasil (1500): O Início da Colonização',
      subtitle: 'A esquadra de Cabral, o primeiro contato com os indígenas e o contexto das Grandes Navegações',
      levelTag: 'Ensino Médio / Vestibular / ENEM',
      summary: 'Em 22 de abril de 1500, a esquadra portuguesa comandada por Pedro Álvares Cabral avistou o Monte Pascoal no litoral sul da Bahia. Esse evento marcou o encontro entre a corte portuguesa e os povos originários Tupiniquins, iniciando o período pré-colonial brasileiro.',
      sections: [
        {
          type: 'concept',
          title: '1. O que foi e por que aconteceu?',
          content: 'A chamada "Descoberta do Brasil" — hoje denominada historiograficamente como a **Chegada dos Portugueses** — aconteceu durante as **Grandes Navegações** dos séculos XV e XVI. Portugal buscava consolidar o monopólio das lucrativas rotas marítimas de especiarias para as Índias (Calicute). A frota de Cabral contava com 13 caravelas e naus e cerca de 1.500 homens. Ao realizar uma manobra de afastamento da costa africana para aproveitar ventos favoráveis (conhecida como "volta do mar"), a esquadra alcançou o litoral da Bahia, aportando em Porto Seguro.'
        },
        {
          type: 'steps',
          title: '2. Cronologia e Fatos Principais de 1500',
          items: [
            '**9 de março de 1500**: A esquadra de Cabral zarpa de Lisboa com destino oficial às Índias.',
            '**21 e 22 de abril de 1500**: Os marinheiros avistam sinais de terra (aves e ervas marinhas) e, no dia 22, avistam o Monte Pascoal (assim batizado por ser época de Páscoa).',
            '**O Primeiro Contato**: Encontro inicial pacífico com os indígenas da etnia Tupiniquim, marcado por curiosidade recíproca e troca de presentes (como gorros e colares).',
            '**A Carta de Pero Vaz de Caminha**: O escrivão oficial da frota relata detalhadamente ao rei D. Manuel I as belezas naturais, a terra fértil ("em se plantando tudo dá") e os costumes dos nativos.',
            '**26 de abril e 1º de maio**: Celebração das duas primeiras missas católicas pelo Frei Henrique de Coimbra, fincando a cruz de madeira para oficializar a posse da Coroa Portuguesa.'
          ]
        },
        {
          type: 'example',
          title: '3. Análise Crítica e Período Pré-Colonial (1500 a 1530)',
          content: 'Historiadores destacam que o termo "descoberta" é eurocêntrico, pois o território já era habitado por mais de 3 milhões de indígenas de diversas etnias há milhares de anos. Nos primeiros 30 anos após a chegada, Portugal não fixou vilas imediatas: focou na exploração do **Pau-Brasil** através do **escambo** (troca da madeira por tecidos, espelhos, facas e machados com os indígenas), antes de iniciar as Capitanias Hereditárias e os engenhos de cana-de-açúcar.'
        },
        {
          type: 'summary',
          title: '4. Resumo em 1 Minuto para Provas e ENEM',
          content: '• **Ano e Líder**: 1500, Pedro Álvares Cabral.\n• **Local**: Porto Seguro e Monte Pascoal (Bahia).\n• **Primeiro Documento**: Carta de Pero Vaz de Caminha ao rei D. Manuel I.\n• **Primeira Atividade Econômica**: Extração de Pau-Brasil via escambo com os povos indígenas.\n• **Tratado Geopolítico**: O Tratado de Tordesilhas (1494) já garantia a Portugal terras a oeste do Atlântico.'
        }
      ],
      followUpQuestions: [
        'Por que os historiadores modernos preferem o termo "Chegada" ou "Invasão" em vez de "Descoberta"?',
        'Qual era o objetivo econômico da Carta de Pero Vaz de Caminha para a Coroa Portuguesa?',
        'Como funcionava o sistema de escambo do Pau-Brasil entre portugueses e indígenas?'
      ],
      audioScript: 'Olá, estudante! Aqui é o seu Tutor IA. Hoje vamos desvendar a Chegada dos Portugueses ao Brasil em 1500! A expedição de Pedro Álvares Cabral fazia parte das Grandes Navegações em busca da rota comercial de especiarias para as Índias. No dia 22 de abril, avistaram o Monte Pascoal na Bahia. O escrivão Pero Vaz de Caminha registrou o primeiro contato com os indígenas em sua famosa carta ao rei D. Manuel I. Ouça atentamente os tópicos a seguir!',
      videoRecommendations: [
        {
          title: 'A Chegada dos Portugueses ao Brasil (1500) Explicada Passo a Passo',
          channel: 'Canal de História Didática',
          description: 'Documentário ilustrado com animações sobre a viagem de Cabral, o encontro cultural e a Carta de Caminha.',
          searchQuery: 'historia do brasil chegada dos portugueses 1500 cabral caminha'
        }
      ]
    },
    quiz: [
      {
        id: 1,
        statement: 'Em 22 de abril de 1500, a esquadra de Pedro Álvares Cabral avistou o litoral brasileiro. Qual foi o primeiro acidente geográfico avistado pelos navegadores e qual região atual ele representa?',
        options: [
          {
            id: 'A',
            text: 'O Monte Pascoal, localizado no atual litoral sul do estado da Bahia.',
            isCorrect: true,
            feedback: 'Correto! Recebeu o nome de Monte Pascoal porque a frota chegou na semana da Páscoa, aportando na região de Porto Seguro (Bahia).'
          },
          {
            id: 'B',
            text: 'O Pão de Açúcar, localizado na Baía de Guanabara no Rio de Janeiro.',
            isCorrect: false,
            feedback: 'Incorreto. A Baía de Guanabara no Rio de Janeiro só foi explorada no ano seguinte, em 1501, por Gaspar de Lemos.'
          },
          {
            id: 'C',
            text: 'O Pico da Neblina, na fronteira norte do Amazonas com a Venezuela.',
            isCorrect: false,
            feedback: 'Incorreto. O Pico da Neblina fica no interior da Amazônia e só foi cartografado no século XX.'
          },
          {
            id: 'D',
            text: 'O Cabo das Tormentas, no litoral de Pernambuco.',
            isCorrect: false,
            feedback: 'Incorreto. O Cabo das Tormentas (depois renomeado para Cabo da Boa Esperança) fica no extremo sul do continente africano.'
          }
        ]
      },
      {
        id: 2,
        statement: 'Qual documento histórico é popularmente conhecido como a "certidão de nascimento do Brasil", por conter os primeiros registros escritos sobre a terra e o encontro com os povos indígenas?',
        options: [
          {
            id: 'A',
            text: 'A Carta de Pero Vaz de Caminha, endereçada ao rei D. Manuel I de Portugal.',
            isCorrect: true,
            feedback: 'Exatamente! O escrivão oficial Pero Vaz de Caminha redigiu o documento descrevendo minuciosamente a natureza, as primeiras impressões dos indígenas Tupiniquins e a celebração da missa.'
          },
          {
            id: 'B',
            text: 'A Lei Áurea, assinada pela Princesa Isabel em 1888.',
            isCorrect: false,
            feedback: 'Incorreto. A Lei Áurea foi assinada quase 400 anos depois, decretando a abolição da escravidão no Brasil imperial.'
          },
          {
            id: 'C',
            text: 'O Tratado de Tordesilhas, pacto diplomático entre Espanha e Portugal de 1494.',
            isCorrect: false,
            feedback: 'Incorreto. O Tratado de Tordesilhas foi um acordo papal prévio de 1494 para dividir zonas de exploração oceânica, não o relato de chegada.'
          },
          {
            id: 'D',
            text: 'A Constituição Cidadã de 1988.',
            isCorrect: false,
            feedback: 'Incorreto. Essa é a atual Carta Magna democrática do Brasil contemporâneo.'
          }
        ]
      },
      {
        id: 3,
        statement: 'Durante as primeiras três décadas após a chegada (período de 1500 a 1530), qual foi a principal relação de trabalho e exploração econômica entre portugueses e indígenas no litoral?',
        options: [
          {
            id: 'A',
            text: 'O escambo do Pau-Brasil: indígenas cortavam e transportavam a madeira em troca de tecidos, facas, espelhos e machados.',
            isCorrect: true,
            feedback: 'Perfeito! No período pré-colonial, Portugal não ocupou terras de imediato. Construiu feitorias costeiras e utilizou o escambo com os nativos para extrair a cobiçada tinta vermelha do pau-brasil.'
          },
          {
            id: 'B',
            text: 'A extração de ouro e pedras preciosas com trabalho escravo em Minas Gerais.',
            isCorrect: false,
            feedback: 'Incorreto. O Ciclo do Ouro em Minas Gerais desenvolveu-se somente no final do século XVII e durante o século XVIII.'
          },
          {
            id: 'C',
            text: 'A criação extensiva de gado no sertão nordestino com vaqueiros assalariados.',
            isCorrect: false,
            feedback: 'Incorreto. A pecuária sertaneja surgiu a partir do século XVII como atividade de apoio aos engenhos açucareiros.'
          },
          {
            id: 'D',
            text: 'A implantação de indústrias têxteis nas primeiras vilas fundadas por Cabral.',
            isCorrect: false,
            feedback: 'Incorreto. Não houve indústria no Brasil colonial; a metrópole inclusive proibia manufaturas no território colonial.'
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------
  // 2. FÍSICA: LEIS DE NEWTON
  // --------------------------------------------------------
  {
    keywords: ['leis de newton', 'newton', 'inercia', 'forca e aceleracao', 'acao e reacao', 'dinamica'],
    course: 'Ensino Médio / ENEM',
    subject: 'Física',
    topic: 'Leis de Newton',
    explanation: {
      title: 'Leis de Newton: A Dinâmica do Movimento Descomplicada',
      subtitle: 'Inércia, Princípio Fundamental da Dinâmica e Ação e Reação no dia a dia',
      levelTag: 'Ensino Médio / Vestibular / ENEM',
      summary: 'As três leis de Newton explicam por que os corpos aceleram, freiam ou permanecem parados. Compreender esses princípios permite prever o movimento de qualquer corpo, desde um carro freado na rua até satélites no espaço.',
      sections: [
        {
          type: 'concept',
          title: '1. O que são as três leis?',
          content: 'Publicadas em 1687 por Isaac Newton, as leis formam a base da Mecânica Clássica:\n• **1ª Lei (Inércia)**: Todo corpo tende a manter sua velocidade constante (ou repouso) a menos que uma força resultante atue sobre ele.\n• **2ª Lei (Princípio Fundamental)**: A aceleração é diretamente proporcional à força resultante e inversamente proporcional à massa (**F = m × a**).\n• **3ª Lei (Ação e Reação)**: Para toda força de ação, existe uma reação de mesma intensidade, mesma direção e sentido oposto, atuando em corpos diferentes.'
        },
        {
          type: 'steps',
          title: '2. Passo a Passo para resolver problemas de Física',
          items: [
            'Desenhe o corpo isolado de seu entorno (Diagrama de Corpo Livre).',
            'Identifique as forças reais aplicadas: Peso (P = m·g), Normal (apoio da superfície), Tração e Atrito.',
            'Calcule a Força Resultante (somando forças no mesmo sentido e subtraindo forças contrárias).',
            'Aplique a equação fundamental: F_resultante = m · a para achar aceleração ou força.'
          ]
        },
        {
          type: 'example',
          title: '3. Exemplos Práticos do Cotidiano',
          content: 'Quando um ônibus freia bruscamente, seu corpo é projetado para a frente não por causa de uma força que te empurra, mas pela sua própria **inércia** (seu corpo já estava em movimento a 50 km/h e quer continuar nessa velocidade). O cinto de segurança aplica a força externa necessária para desacelerar você junto com o veículo.'
        },
        {
          type: 'summary',
          title: '4. Resumo em 1 Minuto',
          content: '• 1ª Lei: Sem força resultante = velocidade constante (ou parado).\n• 2ª Lei: Força gera aceleração (F = m · a).\n• 3ª Lei: Forças sempre surgem aos pares em corpos distintos (ação e reação nunca se cancelam no mesmo corpo).'
        }
      ],
      followUpQuestions: [
        'Por que a força Normal e a força Peso NÃO formam um par de ação e reação?',
        'O que acontece com a aceleração se dobrarmos a força aplicada sobre uma mesma massa?',
        'Como a força de atrito entre o sapato e o chão torna possível a nossa caminhada?'
      ],
      audioScript: 'Olá! Aqui é o seu Tutor IA. Hoje vamos desvendar as Leis de Newton! Lembre-se: quando um carro freia e você é lançado para frente, é a inércia agindo. Para fixar, a segunda lei diz que força é massa vezes aceleração. Ouça atentamente os tópicos a seguir!',
      videoRecommendations: [
        {
          title: 'As 3 Leis de Newton com Animações Práticas',
          channel: 'Física Descomplicada',
          description: 'Vídeo didático demonstrando inércia e ação e reação em acidentes automobilísticos e lançamentos de foguetes.',
          searchQuery: 'fisica leis de newton aula didatica'
        }
      ]
    },
    quiz: [
      {
        id: 1,
        statement: 'Um passageiro é projetado para a frente quando o motorista do ônibus pisa repentinamente no freio. Qual princípio físico explica essa situação?',
        options: [
          {
            id: 'A',
            text: 'Terceira Lei de Newton (Ação e Reação).',
            isCorrect: false,
            feedback: 'Incorreto. A terceira lei trata de pares de forças simultâneas entre dois corpos distintos, e não da tendência de manter velocidade.'
          },
          {
            id: 'B',
            text: 'Primeira Lei de Newton (Princípio da Inércia).',
            isCorrect: true,
            feedback: 'Correto! Pela inércia, o passageiro tende a manter a velocidade que já possuía até que uma força externa (como o cinto de segurança) o detenha.'
          },
          {
            id: 'C',
            text: 'Princípio da Conservação de Energia Térmica.',
            isCorrect: false,
            feedback: 'Incorreto. Energia térmica refere-se a calor e temperatura, não ao estado de movimento cinemático.'
          },
          {
            id: 'D',
            text: 'Lei da Gravitação Universal de Newton.',
            isCorrect: false,
            feedback: 'Incorreto. A gravitação explica a atração entre massas cósmicas e o peso, mas a projeção decorre da inércia.'
          }
        ]
      },
      {
        id: 2,
        statement: 'Se aplicarmos a mesma força resultante sobre dois carrinhos, um com 2 kg e outro com 4 kg, o que acontecerá com a aceleração deles?',
        options: [
          {
            id: 'A',
            text: 'Ambos terão exatamente a mesma aceleração.',
            isCorrect: false,
            feedback: 'Incorreto. Pela fórmula F = m × a, para uma mesma força, maior massa resulta em menor aceleração.'
          },
          {
            id: 'B',
            text: 'O carrinho de 2 kg terá o dobro da aceleração do carrinho de 4 kg.',
            isCorrect: true,
            feedback: 'Exato! A aceleração é inversamente proporcional à massa. Menor massa significa o dobro de aceleração para a mesma força.'
          },
          {
            id: 'C',
            text: 'O carrinho de 4 kg terá o dobro da aceleração.',
            isCorrect: false,
            feedback: 'Incorreto. Quanto mais pesado o objeto, mais difícil acelerá-lo.'
          },
          {
            id: 'D',
            text: 'Nenhum dos carrinhos conseguirá se mover.',
            isCorrect: false,
            feedback: 'Incorreto. Havendo força resultante não nula, sempre haverá aceleração.'
          }
        ]
      },
      {
        id: 3,
        statement: 'Por que a força de Peso e a força Normal NÃO constituem um par de ação e reação?',
        options: [
          {
            id: 'A',
            text: 'Porque ambas estão aplicadas no mesmo corpo (o objeto sobre a mesa).',
            isCorrect: true,
            feedback: 'Perfeito! Os pares de ação e reação SEMPRE atuam em corpos diferentes. A reação ao peso está no centro da Terra.'
          },
          {
            id: 'B',
            text: 'Porque elas apontam sempre para o mesmo lado.',
            isCorrect: false,
            feedback: 'Incorreto. Peso e Normal geralmente apontam em sentidos opostos.'
          },
          {
            id: 'C',
            text: 'Porque a força normal nunca tem a mesma intensidade do peso.',
            isCorrect: false,
            feedback: 'Incorreto. Em superfícies horizontais sem aceleração vertical, suas intensidades são iguais.'
          },
          {
            id: 'D',
            text: 'Porque a física quântica cancela a terceira lei em objetos estáticos.',
            isCorrect: false,
            feedback: 'Incorreto. As leis de Newton são válidas em toda a mecânica clássica macroscópica.'
          }
        ]
      }
    ]
  },

  // --------------------------------------------------------
  // 3. PROGRAMAÇÃO: ESTRUTURAS DE REPETIÇÃO (LOOPS)
  // --------------------------------------------------------
  {
    keywords: ['loops', 'estrutura de repeticao', 'lacos de repeticao', 'for e while', 'while', 'algoritmos', 'programacao'],
    course: 'Ciência da Computação / T.I.',
    subject: 'Algoritmos e Programação',
    topic: 'Estruturas de Repetição (Loops)',
    explanation: {
      title: 'Estruturas de Repetição: Dominando For e While',
      subtitle: 'Como automatizar rotinas e iterar sobre coleções de dados sem repetição manual',
      levelTag: 'Programação Inicial',
      summary: 'Loops ou laços de repetição executam um bloco de código repetidas vezes enquanto uma condição lógica for verdadeira ou por uma contagem pré-determinada de vezes.',
      sections: [
        {
          type: 'concept',
          title: '1. O que são e quando usar For vs While?',
          content: 'Em programação, em vez de reescrever o mesmo comando centenas de vezes, utilizamos laços:\n• **Loop For**: Recomendado quando o número de repetições é conhecido de antemão ou ao percorrer uma lista com tamanho fixo.\n• **Loop While**: Recomendado quando a repetição depende de uma condição futura incerta (ex: repetir até o usuário digitar a senha certa).'
        },
        {
          type: 'steps',
          title: '2. Anatomia de um laço seguro',
          items: [
            'Inicialização: Defina uma variável de controle ou contador antes do laço.',
            'Condição de Parada: Estabeleça o teste lógico que, quando falso, encerra o loop.',
            'Incremento ou Atualização: Altere o estado da variável a cada repetição para evitar loop infinito.',
            'Validação: Garanta que a condição de saída seja matematicamente alcançável.'
          ]
        },
        {
          type: 'example',
          title: '3. Exemplo Prático',
          content: 'Para enviar um e-mail para todos os 50 alunos de uma turma matriculada, usamos o **For** (de 1 até 50). Já para pedir que o usuário digite uma senha correta, usamos o **While** (enquanto a senha for inválida, continue perguntando), pois não há como prever quantas tentativas serão necessárias.'
        },
        {
          type: 'summary',
          title: '4. Resumo em 1 Minuto',
          content: '• **For**: Repetições com contagem ou listas definidas.\n• **While**: Repetições condicionadas a eventos ou validações.\n• **Cuidado**: Sempre atualize a variável de controle para prevenir travamentos por loop infinito.'
        }
      ],
      followUpQuestions: [
        'Como funciona o comando break e continue dentro de um loop?',
        'O que causa e como prevenir um loop infinito na memória do servidor?',
        'Qual a diferença entre While e Do-While?'
      ],
      audioScript: 'Olá, programador em formação! Aqui é o seu Tutor IA. Loops são o coração dos algoritmos modernos! Pense no For como um cronômetro com voltas contadas, e no While como uma sentinela que vigia uma condição até ela mudar. Vamos ver os detalhes!',
      videoRecommendations: [
        {
          title: 'Lógica de Programação: For vs While Descomplicados',
          channel: 'Dev Educativo',
          description: 'Aprenda na prática a sintaxe e a lógica das repetições em código real.',
          searchQuery: 'logica de programacao for while diferenca'
        }
      ]
    },
    quiz: [
      {
        id: 1,
        statement: 'Qual é a principal recomendação para escolher a estrutura "For" ao invés de "While"?',
        options: [
          {
            id: 'A',
            text: 'Quando o número de repetições é conhecido antecipadamente ou percorremos uma lista finita.',
            isCorrect: true,
            feedback: 'Correto! O "For" possui inicialização, condição e incremento integrados na mesma linha.'
          },
          {
            id: 'B',
            text: 'Quando não sabemos quantas vezes o usuário vai errar um login.',
            isCorrect: false,
            feedback: 'Incorreto. Para situações imprevisíveis baseadas em condição de evento, o While é mais natural.'
          },
          {
            id: 'C',
            text: 'Apenas quando o computador não tem memória suficiente.',
            isCorrect: false,
            feedback: 'Incorreto. A escolha do laço é semântica e lógica, não limitação de hardware.'
          },
          {
            id: 'D',
            text: 'Porque o For nunca corre o risco de travar o programa.',
            isCorrect: false,
            feedback: 'Incorreto. Um loop For com condição mal configurada também pode gerar repetição infinita.'
          }
        ]
      },
      {
        id: 2,
        statement: 'O que caracteriza um temido "Loop Infinito" em um algoritmo?',
        options: [
          {
            id: 'A',
            text: 'Um laço que roda extremamente rápido sem gastar energia.',
            isCorrect: false,
            feedback: 'Incorreto. Loops infinitos consomem CPU excessiva e travam o sistema.'
          },
          {
            id: 'B',
            text: 'Um laço cuja condição de parada nunca se torna falsa durante a execução.',
            isCorrect: true,
            feedback: 'Exato! Se a variável de controle não for atualizada, a condição será sempre verdadeira e o laço nunca encerra.'
          },
          {
            id: 'C',
            text: 'Uma função recursiva que retorna zero na primeira tentativa.',
            isCorrect: false,
            feedback: 'Incorreto. Retornar na primeira chamada encerra a execução rapidamente.'
          },
          {
            id: 'D',
            text: 'Um comando que deleta o banco de dados do servidor.',
            isCorrect: false,
            feedback: 'Incorreto. Isso é uma falha de segurança ou query indevida, não loop infinito.'
          }
        ]
      }
    ]
  }
];

// Busca preset com correspondência difusa inteligente
export function findMatchingPreset(topic = '', subject = '') {
  const normTopic = normalizeStr(topic);
  const normSubject = normalizeStr(subject);

  return DEMO_PRESETS.find(preset => {
    // 1. Verifica keywords
    const matchesKeyword = preset.keywords?.some(kw => normTopic.includes(kw) || kw.includes(normTopic));
    if (matchesKeyword) return true;

    // 2. Verifica nome exato do tópico
    const normPresetTopic = normalizeStr(preset.topic);
    if (normTopic.includes(normPresetTopic) || normPresetTopic.includes(normTopic)) return true;

    return false;
  });
}

// Identifica a área do conhecimento para gerar conteúdo coerente (sem falar de fórmulas em história!)
function detectSubjectDomain(subject = '', topic = '') {
  const text = `${normalizeStr(subject)} ${normalizeStr(topic)}`;

  if (text.includes('hist') || text.includes('brasil') || text.includes('sociol') || text.includes('filos') || text.includes('geograf') || text.includes('guerra') || text.includes('revolu')) {
    return 'humanas';
  }
  if (text.includes('bio') || text.includes('saude') || text.includes('celul') || text.includes('corpo') || text.includes('medic')) {
    return 'biologicas';
  }
  if (text.includes('matemat') || text.includes('fisi') || text.includes('quim') || text.includes('calcul') || text.includes('engenhar')) {
    return 'exatas';
  }
  if (text.includes('direit') || text.includes('constitu') || text.includes('jurid') || text.includes('lei') || text.includes('artigo')) {
    return 'direito';
  }
  if (text.includes('comput') || text.includes('program') || text.includes('soft') || text.includes('codigo') || text.includes('dados')) {
    return 'tecnologia';
  }
  return 'geral';
}

// Gerador dinâmico contextualizado por área do conhecimento
export function generateSmartDemoExplanation(course, subject, topic, question, format = 'text') {
  const preset = findMatchingPreset(topic, subject);
  if (preset) {
    const res = JSON.parse(JSON.stringify(preset.explanation));
    res.format = format;
    return res;
  }

  const domain = detectSubjectDomain(subject, topic);

  if (domain === 'humanas') {
    return {
      title: `${topic}: Contexto Histórico e Análise Crítica`,
      subtitle: `Estudo analítico de ${subject} para estudantes de ${course}`,
      levelTag: 'Ciências Humanas / História',
      format: format,
      summary: `Uma análise aprofundada sobre ${topic}, abordando as causas históricas, os principais agentes sociais, documentos da época e seus impactos na sociedade moderna.`,
      sections: [
        {
          type: 'concept',
          title: '1. Contexto Histórico e Motivações',
          content: `O estudo de **${topic}** dentro de **${subject}** nos ajuda a entender as transformações políticas, sociais e econômicas que moldaram o nosso tempo. Nenhum evento histórico ocorre isoladamente: ${topic} foi impulsionado por tensões sociais, interesses econômicos e transformações culturais de sua época.`
        },
        {
          type: 'steps',
          title: '2. Cronologia e Principais Fases',
          items: [
            `**Origens e Antecedentes**: Identificação dos conflitos e motivações que prepararam o terreno para ${topic}.`,
            `**O Ponto de Virada**: O acontecimento ou decisão central que desencadeou o desenrolar dos fatos.`,
            `**Principais Agentes e Documentos**: As figuras históricas, grupos sociais e relatos deixados por quem viveu o período.`,
            `**Consequências Históricas**: Como esse marco alterou as leis, fronteiras, relações de trabalho e a memória coletiva.`
          ]
        },
        {
          type: 'example',
          title: '3. Impacto na Sociedade e Visão Crítica',
          content: `Ao analisar **${topic}**, historiadores contemporâneos evitam explicações simplistas de "heróis ou vilões". Em vez disso, investigam como diferentes classes sociais foram afetadas e como as consequências desse evento ainda ecoam na cultura, na política e nas desigualdades de hoje.`
        },
        {
          type: 'summary',
          title: '4. Síntese em 1 Minuto para Provas',
          content: `Para fixar na memória: **${topic}** sintetiza-se pelo entendimento de seu contexto cronológico em ${subject}, pelas causas econômicas/sociais e pelo legado histórico deixado para o curso de ${course}.`
        }
      ],
      followUpQuestions: [
        `Quais foram as principais causas econômicas e políticas que levaram a ${topic}?`,
        `Como diferentes grupos sociais da época participaram ou foram impactados por ${topic}?`,
        `Quais fontes primárias ou documentos históricos são fundamentais para estudar esse evento?`
      ],
      audioScript: `Olá, estudante! Aqui é o seu Tutor IA. Hoje estamos estudando ${topic}, na disciplina de ${subject}. Compreender a história não é decorar datas, mas entender as causas humanas e sociais que moldaram nosso mundo. Acompanhe a análise a seguir!`,
      videoRecommendations: [
        {
          title: `Documentário Histórico: Entendendo ${topic} Passo a Passo`,
          channel: 'História em Foco',
          description: `Análise cronológica com mapas e gravuras da época sobre ${topic}.`,
          searchQuery: `${subject} ${topic} documentario historia resumo`
        }
      ]
    };
  }

  // Padrão Geral / Exatas / Outras áreas
  return {
    title: `${topic} em ${subject}`,
    subtitle: `Guia Didático do Tutor IA para estudantes de ${course}`,
    levelTag: 'Conteúdo Personalizado',
    format: format,
    summary: `Uma explicação passo a passo e didática sobre ${topic}, focando nos conceitos mais cobrados e no entendimento prático para ${course}.`,
    sections: [
      {
        type: 'concept',
        title: '1. O que é e por que isso é fundamental?',
        content: `O estudo de **${topic}** dentro de **${subject}** é um pilar essencial para o curso de **${course}**. O seu objetivo não é a memorização mecânica, mas capacitar você a reconhecer problemas, analisar variáveis e tomar decisões fundamentadas na prática.`
      },
      {
        type: 'steps',
        title: '2. Passo a Passo do Aprendizado',
        items: [
          `Defina os termos fundamentais e conceitos básicos de ${topic}.`,
          `Observe a lógica de funcionamento e os princípios que regem este tema em ${subject}.`,
          `Analise um caso prático simplificado antes de avançar para cenários complexos.`,
          `Identifique as armadilhas conceituais e dúvidas frequentes dos estudantes.`
        ]
      },
      {
        type: 'example',
        title: '3. Exemplo Prático do Cotidiano',
        content: `Pense em como **${topic}** se aplica na vida real: ao tomar decisões técnicas no curso de ${course}, compreender este princípio evita retrabalho e permite solucionar desafios com clareza e método.`
      },
      {
        type: 'summary',
        title: '4. Resumo em 1 Minuto',
        content: `Para fixar na memória: **${topic}** resume-se em dominar os fundamentos de ${subject}, seguir um raciocínio lógico e testar com exercícios práticos para garantir retenção de longo prazo.`
      }
    ],
    followUpQuestions: [
      `Quais são os erros conceituais mais comuns em ${topic}?`,
      `Como este assunto se conecta com as próximas matérias de ${course}?`,
      `Existe uma analogia simples para memorizar os princípios de ${topic}?`
    ],
    audioScript: `Olá, estudante! Aqui é o seu Tutor IA. Hoje estamos estudando ${topic}, na disciplina de ${subject}. Foque na compreensão dos conceitos antes de tentar memorizar regras. Acompanhe os tópicos preparados especialmente para o seu curso de ${course}!`,
    videoRecommendations: [
      {
        title: `Aula Completa: Entendendo ${topic} Passo a Passo`,
        channel: 'Canal Educativo Aberto',
        description: `Complemento audiovisual recomendado para fixar o assunto ${topic} em ${subject}.`,
        searchQuery: `${subject} ${topic} explicacao didatica`
      }
    ]
  };
}

// Gerador de questões contextuais conectadas com a leitura
export function generateDemoQuiz(course, subject, topic, explanationContext = null) {
  const preset = findMatchingPreset(topic, subject);
  if (preset && preset.quiz && preset.quiz.length > 0) {
    return JSON.parse(JSON.stringify(preset.quiz));
  }

  const domain = detectSubjectDomain(subject, topic);

  if (domain === 'humanas') {
    return [
      {
        id: 1,
        statement: `Ao analisar criticamente o tema "${topic}" na disciplina de ${subject}, qual é a interpretação historiográfica mais adequada?`,
        options: [
          {
            id: 'A',
            text: `Compreender as causas socioeconômicas, as motivações dos agentes da época e os impactos históricos de ${topic}.`,
            isCorrect: true,
            feedback: `Exato! A história moderna busca compreender o contexto, as fontes e os impactos sociais, evitando visões simplistas.`
          },
          {
            id: 'B',
            text: `Apenas memorizar datas e nomes isolados sem entender os conflitos e interesses da época.`,
            isCorrect: false,
            feedback: `Incorreto. A história não se resume a datas decoradas; seu valor está em compreender as transformações humanas.`
          },
          {
            id: 'C',
            text: `Julgar os acontecimentos históricos ignorando os costumes e a mentalidade do período estudado.`,
            isCorrect: false,
            feedback: `Incorreto. O anacronismo (julgar o passado com a mentalidade do presente) prejudica a análise histórica.`
          },
          {
            id: 'D',
            text: `Considerar que ${topic} não teve nenhuma relevância para a formação do mundo contemporâneo.`,
            isCorrect: false,
            feedback: `Incorreto. Grandes eventos históricos deixam heranças culturais, políticas e sociais visíveis até hoje.`
          }
        ]
      },
      {
        id: 2,
        statement: `Qual é o papel das fontes e documentos históricos na compreensão de "${topic}"?`,
        options: [
          {
            id: 'A',
            text: 'Fornecer vestígios e relatos da época que devem ser analisados criticamente pelo pesquisador.',
            isCorrect: true,
            feedback: 'Correto! Cartas, leis, relatos e registros materiais são as fontes primárias que permitem reconstruir o passado.'
          },
          {
            id: 'B',
            text: 'Fontes escritas da época contam sempre a verdade absoluta sem nenhuma intenção política.',
            isCorrect: false,
            feedback: 'Incorreto. Todo documento expressa o ponto de vista e os interesses de quem o escreveu.'
          },
          {
            id: 'C',
            text: 'Documentos do passado devem ser ignorados para priorizar apenas opiniões de redes sociais.',
            isCorrect: false,
            feedback: 'Incorreto. O método histórico baseia-se no rigor científico e na consulta a fontes documentais.'
          },
          {
            id: 'D',
            text: 'Somente vídeos gravados na época possuem validade historiográfica.',
            isCorrect: false,
            feedback: 'Incorreto. Em períodos anteriores ao século XIX e XX, os registros são textuais, artísticos e arqueológicos.'
          }
        ]
      },
      {
        id: 3,
        statement: `Qual foi a principal consequência ou legado de "${topic}" para a sociedade?`,
        options: [
          {
            id: 'A',
            text: `Alterou relações de poder, estruturas econômicas e influenciou a cultura e as leis posteriores.`,
            isCorrect: true,
            feedback: `Perfeito! Compreender o legado de ${topic} é essencial para entender as raízes do nosso presente.`
          },
          {
            id: 'B',
            text: 'O evento foi completamente esquecido e não deixou nenhum reflexo cultural.',
            isCorrect: false,
            feedback: 'Incorreto. Marcos históricos relevantes são continuamente estudados e reinterpretados.'
          },
          {
            id: 'C',
            text: 'Não teve nenhum impacto sobre a população da época.',
            isCorrect: false,
            feedback: 'Incorreto. Eventos desse porte afetam diretamente a vida cotidiana das pessoas.'
          },
          {
            id: 'D',
            text: 'Resolveu todos os problemas sociais da humanidade para sempre.',
            isCorrect: false,
            feedback: 'Incorreto. Cada período histórico soluciona certas questões e cria novos desafios.'
          }
        ]
      }
    ];
  }

  // Padrão Geral / Exatas
  return [
    {
      id: 1,
      statement: `Em relação ao conteúdo fundamental de "${topic}" na disciplina de ${subject}, qual afirmação expressa a abordagem didática correta?`,
      options: [
        {
          id: 'A',
          text: `Compreender a base conceitual de ${topic} e sua aplicação prática no curso de ${course}.`,
          isCorrect: true,
          feedback: `Excelente! O entendimento conceitual alinhado à prática é o método mais eficaz de fixação.`
        },
        {
          id: 'B',
          text: `Apenas memorizar definições na véspera da prova sem entender as causas.`,
          isCorrect: false,
          feedback: `Incorreto. A memorização mecânica gera esquecimento rápido e não prepara para resolver problemas reais.`
        },
        {
          id: 'C',
          text: `Desconsiderar a relação deste assunto com o restante da disciplina de ${subject}.`,
          isCorrect: false,
          feedback: `Incorreto. Todos os tópicos educacionais são conectados entre si.`
        },
        {
          id: 'D',
          text: `Pular a teoria e ir direto para simulados sem saber os fundamentos.`,
          isCorrect: false,
          feedback: `Incorreto. Sem a base teórica, o estudante tende a errar por falta de interpretação.`
        }
      ]
    },
    {
      id: 2,
      statement: `Ao resolver um problema prático envolvendo "${topic}", qual é a atitude mais recomendada pelo Tutor IA?`,
      options: [
        {
          id: 'A',
          text: 'Chutar qualquer alternativa e ignorar a correção.',
          isCorrect: false,
          feedback: 'Incorreto. Ignorar os erros impede que o cérebro identifique lacunas de aprendizado.'
        },
        {
          id: 'B',
          text: 'Identificar com clareza o objetivo, analisar os dados fornecidos e revisar o passo a passo conceitual.',
          isCorrect: true,
          feedback: 'Correto! Decompor o problema em etapas simples é o segredo para destravar qualquer conteúdo complexo.'
        },
        {
          id: 'C',
          text: 'Desistir do exercício se não souber a resposta imediatamente.',
          isCorrect: false,
          feedback: 'Incorreto! O raciocínio gradual é que constrói a habilidade de resolver problemas.'
        },
        {
          id: 'D',
          text: 'Copiar a resposta de um colega sem ler a justificativa.',
          isCorrect: false,
          feedback: 'Incorreto. A cópia passiva não gera desenvolvimento cognitivo.'
        }
      ]
    },
    {
      id: 3,
      statement: `Como o estudante pode comprovar que realmente dominou o tema "${topic}"?`,
      options: [
        {
          id: 'A',
          text: 'Sendo capaz de explicar o conceito com suas próprias palavras de forma simples para outra pessoa.',
          isCorrect: true,
          feedback: 'Perfeito! É a famosa Técnica Feynman: ensinar algo de forma simples comprova domínio real do assunto.'
        },
        {
          id: 'B',
          text: 'Lendo o mesmo parágrafo dez vezes seguidas sem fazer anotações.',
          isCorrect: false,
          feedback: 'Incorreto. A repetição passiva gera a ilusão de familiaridade, mas pouca retenção real.'
        },
        {
          id: 'C',
          text: 'Assistindo a um vídeo em velocidade rápida sem praticar nenhum exercício.',
          isCorrect: false,
          feedback: 'Incorreto. A prática ativa com exercícios é indispensável.'
        },
        {
          id: 'D',
          text: 'Guardando o material e nunca mais revisando até o final do semestre.',
          isCorrect: false,
          feedback: 'Incorreto. Revisões periódicas são vitais para transferir o conteúdo para a memória de longo prazo.'
        }
      ]
    }
  ];
}
