/**
 * MenuSafe - Analisador de Cardápios e Restrições Alimentares
 * Projeto Escolar - Curso Técnico de Desenvolvimento de Sistemas
 * Programação Mobile / Web
 */

// ==========================================================================
// Polyfills e Utilitários de Compatibilidade Cross-Browser
// ==========================================================================
// Polyfill defensivo para Array.from
if (!Array.from) {
  Array.from = function(iterable) {
    if (iterable == null) return [];
    var res = [];
    if (typeof iterable.forEach === 'function') {
      iterable.forEach(function(item) { res.push(item); });
    } else {
      for (var i = 0; i < iterable.length; i++) {
        res.push(iterable[i]);
      }
    }
    return res;
  };
}

// Polyfill defensivo para Element.prototype.closest
if (typeof Element !== 'undefined' && !Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do {
      if (Element.prototype.matches && Element.prototype.matches.call(el, s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

/**
 * Executa rolagem suave de forma segura com fallback para navegadores antigos
 */
function safeScrollIntoView(element, options) {
  if (!element || typeof element.scrollIntoView !== 'function') return;
  try {
    element.scrollIntoView(options);
  } catch (e) {
    try {
      element.scrollIntoView(true);
    } catch (err) {
      // Ignora falha de rolagem em ambientes sem suporte
    }
  }
}

/**
 * Gerenciador seguro de armazenamento local com fallback em memória
 * Previne SecurityError no Safari Modo Privado ou em navegadores com cookies/storage bloqueados
 */
const safeStorage = {
  isAvailable() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      const testKey = '__menusafe_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },
  _memory: {},
  getItem(key) {
    try {
      if (this.isAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Fallback em memória
    }
    return Object.prototype.hasOwnProperty.call(this._memory, key) ? this._memory[key] : null;
  },
  setItem(key, value) {
    try {
      if (this.isAvailable()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      // Fallback em memória
    }
    this._memory[key] = String(value);
  },
  removeItem(key) {
    try {
      if (this.isAvailable()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      // Fallback em memória
    }
    delete this._memory[key];
  }
};

// ==========================================================================
// Base de Conhecimento de Alérgenos e Ingredientes Relacionados
// ==========================================================================
const ALLERGEN_DATABASE = {
  lactose: {
    name: 'Lactose',
    icon: '🥛',
    // Palavras diretamente relacionadas à Lactose (requeijão, creme de leite, queijo, manteiga, leite, etc.)
    directKeywords: [
      'creme de leite', 'doce de leite', 'leite condensado', 'leite em po', 'leite vegetal com lactose',
      'soro de leite', 'molho branco', 'quatro queijos', '4 queijos', 'requeijao', 'requeijão',
      'leite', 'leites', 'queijo', 'queijos', 'manteiga', 'manteigas', 'iogurte', 'iogurtes',
      'nata', 'coalhada', 'ricota', 'parmesao', 'parmesão', 'mussarela', 'mozzarella',
      'provolone', 'gorgonzola', 'cheddar', 'brie', 'catupiry', 'whey', 'chantilly',
      'bechamel', 'fondue', 'strogonoff', 'estrogonofe', 'mascarpone', 'gouda', 'lactose'
    ],
    // Possibilidades que exigem confirmação (não podem ser confirmadas apenas pelo texto)
    cautionKeywords: [
      { term: 'gratinado', reason: 'Pratos gratinados frequentemente levam queijo fundido ou molho bechamel/branco.' },
      { term: 'cremoso', reason: 'Preparações descritas como cremosas costumam utilizar creme de leite, requeijão ou manteiga.' },
      { term: 'pure', reason: 'Purês de batata ou mandioca costumam levar leite e manteiga no preparo tradicional.' },
      { term: 'sobremesa', reason: 'Doces e sobremesas em geral têm alta probabilidade de conter leite, leite condensado ou manteiga.' },
      { term: 'chocolate', reason: 'Chocolates ao leite e achocolatados contêm derivados de leite.' },
      { term: 'molho de queijo', reason: 'Possível uso de laticínios na base do molho.' }
    ]
  },

  gluten: {
    name: 'Glúten',
    icon: '🌾',
    // Palavras diretamente relacionadas ao Glúten (trigo, farinha de trigo, pão, macarrão, etc.)
    directKeywords: [
      'farinha de trigo', 'farelo de trigo', 'cuscuz de trigo', 'pao de forma', 'pao frances',
      'pão de forma', 'pão francês', 'farinha de rosca', 'pao', 'pão', 'paes', 'pães',
      'trigo', 'trigos', 'macarrao', 'macarrão', 'massa', 'massas', 'cevada', 'centeio',
      'aveia', 'malte', 'semola', 'sêmola', 'espelta', 'pizza', 'pizzas', 'torrada', 'torradas',
      'cerveja', 'cervejas', 'biscoito', 'biscoitos', 'bolacha', 'bolachas', 'bolo', 'bolos',
      'torta', 'tortas', 'crostini', 'croutons', 'crouton', 'croissant', 'esfiha', 'kibe',
      'quibe', 'coxinha', 'pastel', 'pasteis', 'pastéis', 'lasanha', 'panqueca', 'panquecas',
      'waffle', 'shoyu', 'gluten', 'glúten'
    ],
    cautionKeywords: [
      { term: 'milanesa', reason: 'Preparações à milanesa costumam ser empanadas com farinha de trigo ou farinha de rosca.' },
      { term: 'empanado', reason: 'Alimentos empanados quase sempre utilizam farinha de trigo.' },
      { term: 'frito com farinha', reason: 'Pode haver uso de farinha de trigo na crosta de fritura.' },
      { term: 'molho escuro', reason: 'Molhos como madeira ou shoyu tradicional costumam ter trigo como espessante.' },
      { term: 'fritura', reason: 'Óleos de fritura compartilhados podem conter resíduos de farinha e causar contaminação cruzada.' }
    ]
  },

  amendoim: {
    name: 'Amendoim',
    icon: '🥜',
    // Palavras diretamente relacionadas ao Amendoim (amendoim, pasta de amendoim, etc.)
    directKeywords: [
      'pasta de amendoim', 'manteiga de amendoim', 'oleo de amendoim', 'óleo de amendoim',
      'praline de amendoim', 'pe de moleque', 'pé de moleque', 'amendoim', 'amendoins',
      'pacoca', 'paçoca', 'arachis', 'satay'
    ],
    cautionKeywords: [
      { term: 'farofa doce', reason: 'Farofas doces e coberturas de açaí frequentemente incluem amendoim moído ou xerém.' },
      { term: 'tailandesa', reason: 'Pratos da culinária tailandesa frequentemente levam amendoim como guarnição ou base de molho.' },
      { term: 'barra de cereal', reason: 'Barras de cereais e granolas têm alto risco de conter amendoim ou traços.' },
      { term: 'castanhas', reason: 'Mix de castanhas e nozes artesanais podem conter amendoim por proximidade de manipulação.' }
    ]
  },

  ovo: {
    name: 'Ovo',
    icon: '🥚',
    // Palavras diretamente relacionadas ao Ovo (ovo, maionese, claras, gemas, etc.)
    directKeywords: [
      'clara de ovo', 'claras de ovo', 'gema de ovo', 'gemas de ovo', 'ovo caipira',
      'ovo cozido', 'ovo frito', 'ovo pochê', 'ovo murcho', 'molho tartaro', 'molho tártaro',
      'molho caesar', 'ovo', 'ovos', 'maionese', 'maioneses', 'gema', 'gemas',
      'clara', 'claras', 'merengue', 'omelete', 'omeletes', 'sufle', 'suflê',
      'suspiro', 'suspiros', 'gemada', 'quiche', 'albumina', 'hollandaise'
    ],
    cautionKeywords: [
      { term: 'massa fresca', reason: 'Massas artesanais frescas levam ovos em sua receita tradicional.' },
      { term: 'empanado', reason: 'O método clássico de empanar envolve passar o alimento em ovos batidos antes da farinha.' },
      { term: 'milanesa', reason: 'Pratos à milanesa usam ovos para fixar a camada de farinha.' },
      { term: 'molho de salada cremoso', reason: 'Muitos molhos de salada levam gemas ou maionese na emulsão.' }
    ]
  },

  frutos_do_mar: {
    name: 'Frutos do mar',
    icon: '🦐',
    // Palavras diretamente relacionadas a Frutos do mar (camarão, lula, polvo, mexilhão, etc.)
    directKeywords: [
      'frutos do mar', 'fruto do mar', 'camarao', 'camarão', 'camaroes', 'camarões',
      'lula', 'lulas', 'polvo', 'polvos', 'mexilhao', 'mexilhão', 'mexilhoes', 'mexilhões',
      'lagosta', 'lagostas', 'siri', 'siris', 'caranguejo', 'caranguejos', 'marisco', 'mariscos',
      'ostra', 'ostras', 'vieira', 'vieiras', 'pescado', 'pescados', 'peixe', 'peixes',
      'salmao', 'salmão', 'atum', 'bacalhau', 'tilapia', 'tilápia', 'sardinha', 'anchova',
      'robalo', 'paella', 'moqueca', 'caldeirada', 'sushi', 'sashimi', 'ceviche'
    ],
    cautionKeywords: [
      { term: 'dashi', reason: 'Caldo oriental tradicional feito com peixe desidratado (bonito), base de missoshiru.' },
      { term: 'molho de ostra', reason: 'Condimento escuro oriental obtido a partir de extrato de ostras.' },
      { term: 'caldo de peixe', reason: 'Muitos caldos de risoto ou ensopados utilizam fundos de peixe ou camarão.' },
      { term: 'comida japonesa', reason: 'Ambientes de preparo japonês possuem alta frequência e contato cruzado com pescados.' }
    ]
  }
};

// Termos genéricos de alerta que representam possibilidades não confirmadas pelo texto
const GENERAL_UNCERTAINTIES = [
  { term: 'molho da casa', reason: 'Molhos especiais ou da casa geralmente não têm ingredientes divulgados e exigem confirmação.' },
  { term: 'molho especial', reason: 'Receita secreta ou especial. Confirme a composição exata com a equipe.' },
  { term: 'tempero do chef', reason: 'Preparo exclusivo que pode incluir caldos concentrados ou ingredientes alergênicos ocultos.' },
  { term: 'fritura compartilhada', reason: 'Alto risco de contaminação cruzada pelo uso do mesmo óleo para diversos itens.' },
  { term: 'recheio especial', reason: 'Recheios não especificados podem conter queijos, massas ou derivados.' }
];

// ==========================================================================
// Funções Utilitárias de Normalização e Busca Textual
// ==========================================================================
/**
 * Remove acentos de forma defensiva com suporte a fallback caso .normalize('NFD') não esteja disponível
 */
function removeAccentsFallback(str) {
  return str
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n');
}

/**
 * Normaliza o texto removendo acentos, pontuações e convertendo para minúsculas
 */
function normalizeText(text) {
  if (!text) return '';
  let str = String(text).toLowerCase();

  if (typeof str.normalize === 'function') {
    try {
      str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      str = removeAccentsFallback(str);
    }
  } else {
    str = removeAccentsFallback(str);
  }

  return str
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se um termo ou frase composta existe no texto normalizado utilizando limites de palavra
 */
function containsTerm(normalizedText, term) {
  const normTerm = normalizeText(term);
  if (!normTerm) return false;
  // Escapa caracteres especiais de regex
  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
  return regex.test(normalizedText);
}

// ==========================================================================
// Base de Imagens e Ingredientes Identificados
// ==========================================================================
const INGREDIENTS_DATABASE = [
  // Proteínas e Carnes
  {
    name: 'Frango',
    keywords: ['frango', 'file de frango', 'filé de frango', 'peito de frango', 'galinha', 'coxa de frango', 'sobrecoxa'],
    imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍗',
    restrictionKey: null
  },
  {
    name: 'Carne Bovina',
    keywords: ['carne', 'bife', 'alcatra', 'picanha', 'patinho', 'carne moida', 'carne moída', 'contrafile', 'costela'],
    imageUrl: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥩',
    restrictionKey: null
  },
  {
    name: 'Camarão',
    keywords: ['camarao', 'camarão', 'camaroes', 'camarões'],
    imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🦐',
    restrictionKey: 'frutos_do_mar'
  },
  {
    name: 'Peixe / Salmão',
    keywords: ['peixe', 'peixes', 'salmao', 'salmão', 'atum', 'tilapia', 'tilápia', 'bacalhau', 'pescado'],
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🐟',
    restrictionKey: 'frutos_do_mar'
  },
  {
    name: 'Frutos do Mar',
    keywords: ['lula', 'polvo', 'mexilhao', 'mexilhão', 'marisco', 'ostra', 'siri', 'caranguejo', 'lagosta'],
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🦞',
    restrictionKey: 'frutos_do_mar'
  },
  {
    name: 'Ovo',
    keywords: ['ovo', 'ovos', 'clara', 'claras', 'gema', 'gemas', 'omelete', 'ovo frito', 'ovo cozido'],
    imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥚',
    restrictionKey: 'ovo'
  },
  {
    name: 'Maionese',
    keywords: ['maionese', 'maioneses'],
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥄',
    restrictionKey: 'ovo'
  },

  // Laticínios e Derivados (Lactose)
  {
    name: 'Queijo',
    keywords: ['queijo', 'queijos', 'mussarela', 'mozzarella', 'parmesao', 'parmesão', 'provolone', 'cheddar', 'gorgonzola', 'brie', 'catupiry', 'ricota'],
    imageUrl: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🧀',
    restrictionKey: 'lactose'
  },
  {
    name: 'Leite',
    keywords: ['leite', 'leites', 'leite condensado', 'leite em po', 'leite em pó', 'soro de leite'],
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥛',
    restrictionKey: 'lactose'
  },
  {
    name: 'Manteiga',
    keywords: ['manteiga', 'manteigas'],
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🧈',
    restrictionKey: 'lactose'
  },
  {
    name: 'Requeijão / Iogurte',
    keywords: ['requeijao', 'requeijão', 'creme de leite', 'nata', 'iogurte', 'coalhada'],
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥣',
    restrictionKey: 'lactose'
  },

  // Grãos, Cereais e Massas (Glúten e outros)
  {
    name: 'Arroz',
    keywords: ['arroz', 'arroz branco', 'arroz integral', 'risoto'],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍚',
    restrictionKey: null
  },
  {
    name: 'Trigo / Farinha',
    keywords: ['trigo', 'farinha de trigo', 'farinha', 'farofa', 'farelo de trigo'],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🌾',
    restrictionKey: 'gluten'
  },
  {
    name: 'Macarrão / Massa',
    keywords: ['macarrao', 'macarrão', 'massa', 'massas', 'espaguete', 'penne', 'lasanha'],
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍝',
    restrictionKey: 'gluten'
  },
  {
    name: 'Pão',
    keywords: ['pao', 'pão', 'paes', 'pães', 'pao frances', 'pão francês', 'torrada', 'croissant', 'sanduiche', 'sanduíche'],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍞',
    restrictionKey: 'gluten'
  },
  {
    name: 'Pizza',
    keywords: ['pizza', 'pizzas'],
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍕',
    restrictionKey: 'gluten'
  },
  {
    name: 'Amendoim',
    keywords: ['amendoim', 'amendoins', 'pasta de amendoim', 'pacoca', 'paçoca', 'manteiga de amendoim'],
    imageUrl: 'https://images.unsplash.com/photo-1569466547631-0df0bdf4b5b7?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥜',
    restrictionKey: 'amendoim'
  },
  {
    name: 'Feijão',
    keywords: ['feijao', 'feijão', 'feijoada'],
    imageUrl: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🫘',
    restrictionKey: null
  },

  // Vegetais, Legumes e Verduras
  {
    name: 'Brócolis',
    keywords: ['brocolis', 'brócolis'],
    imageUrl: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥦',
    restrictionKey: null
  },
  {
    name: 'Tomate',
    keywords: ['tomate', 'tomates', 'molho de tomate', 'extrato de tomate'],
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍅',
    restrictionKey: null
  },
  {
    name: 'Batata',
    keywords: ['batata', 'batatas', 'batata frita', 'batata doce', 'pure', 'purê'],
    imageUrl: 'https://images.unsplash.com/photo-1518013034458-30b0ee243591?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥔',
    restrictionKey: null
  },
  {
    name: 'Alface / Salada',
    keywords: ['alface', 'salada', 'rucula', 'rúcula', 'folhas'],
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥗',
    restrictionKey: null
  },
  {
    name: 'Cenoura',
    keywords: ['cenoura', 'cenouras'],
    imageUrl: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥕',
    restrictionKey: null
  },
  {
    name: 'Cebola',
    keywords: ['cebola', 'cebolas'],
    imageUrl: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🧅',
    restrictionKey: null
  },
  {
    name: 'Alho',
    keywords: ['alho', 'alhos'],
    imageUrl: 'https://images.unsplash.com/photo-1615477055959-198f39fcad82?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🧄',
    restrictionKey: null
  },
  {
    name: 'Alho-poró',
    keywords: ['alho-poro', 'alho-poró', 'alho poro', 'alho poró'],
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥬',
    restrictionKey: null
  },
  {
    name: 'Cogumelos',
    keywords: ['cogumelo', 'cogumelos', 'champignon', 'shimeji', 'shitake'],
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍄',
    restrictionKey: null
  },
  {
    name: 'Milho',
    keywords: ['milho', 'milhos'],
    imageUrl: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🌽',
    restrictionKey: null
  },
  {
    name: 'Abacate',
    keywords: ['abacate', 'guacamole'],
    imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🥑',
    restrictionKey: null
  },
  {
    name: 'Limão',
    keywords: ['limao', 'limão'],
    imageUrl: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍋',
    restrictionKey: null
  },
  {
    name: 'Chocolate',
    keywords: ['chocolate', 'chocolates', 'cacau'],
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🍫',
    restrictionKey: null
  },
  {
    name: 'Azeite de Oliva',
    keywords: ['azeite', 'azeite de oliva', 'oleo', 'óleo'],
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=320&q=80',
    fallbackIcon: '🫒',
    restrictionKey: null
  }
];

/**
 * Identifica os ingredientes no texto e associa imagem e status de restrição
 */
function detectIngredients(dishText, activeRestrictions) {
  const normalizedDish = normalizeText(dishText);
  const detected = [];
  const matchedNames = new Set();

  // 1. Mapeia ingredientes do catálogo com prioridade
  INGREDIENTS_DATABASE.forEach(item => {
    const hasMatch = item.keywords.some(kw => containsTerm(normalizedDish, kw));
    if (hasMatch && !matchedNames.has(item.name)) {
      matchedNames.add(item.name);
      
      let isAllergen = false;
      let allergenName = '';
      if (item.restrictionKey && activeRestrictions.includes(item.restrictionKey)) {
        isAllergen = true;
        const allergen = ALLERGEN_DATABASE[item.restrictionKey];
        allergenName = allergen ? allergen.name : 'Restrição';
      }

      detected.push({
        name: item.name,
        imageUrl: item.imageUrl,
        fallbackIcon: item.fallbackIcon,
        isAllergen: isAllergen,
        allergenName: allergenName,
        statusClass: isAllergen ? 'danger' : 'safe',
        badgeText: isAllergen ? `Contém ${allergenName} 🚫` : 'Compatível ✔'
      });
    }
  });

  // 2. Mapeia termos adicionais separados por vírgula ou ' e ' que não foram encontrados
  const rawTokens = dishText
    .split(/[,;\n+]+|\s+e\s+|\s+com\s+/i)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !['prato', 'receita', 'molho', 'especial', 'delicioso', 'fresco'].includes(t.toLowerCase()));

  rawTokens.forEach(tok => {
    const normTok = normalizeText(tok);
    const alreadyFound = Array.from(matchedNames).some(name => normalizeText(name).includes(normTok) || normTok.includes(normalizeText(name)));
    if (!alreadyFound && matchedNames.size < 8 && !matchedNames.has(tok)) {
      matchedNames.add(tok);
      detected.push({
        name: tok.charAt(0).toUpperCase() + tok.slice(1),
        imageUrl: '',
        fallbackIcon: '🍽️',
        isAllergen: false,
        allergenName: '',
        statusClass: 'safe',
        badgeText: 'Ingrediente Identificado'
      });
    }
  });

  return detected;
}

// ==========================================================================
// Motor Aprimorado de Análise Alimentar
// ==========================================================================
/**
 * Analisa o prato/ingredientes informados confrontando com as restrições selecionadas
 * 
 * Regras:
 * 1. "Evitar": Se encontrar um ingrediente diretamente relacionado a uma restrição selecionada.
 * 2. "Atenção": Se houver uma possibilidade que não possa ser confirmada apenas pelo texto
 *    (métodos de preparo suspeitos, termos genéricos, texto curto).
 * 3. "Compatível": Se não encontrar nenhum ingrediente relacionado às restrições selecionadas,
 *    incluindo pequeno aviso de que a informação não substitui a confirmação no estabelecimento.
 */
function analyzeDish(dishText, activeRestrictions) {
  const normalizedDish = normalizeText(dishText);
  
  const results = {
    dishName: dishText.trim(),
    status: 'safe', // 'safe' (Compatível), 'warning' (Atenção), 'danger' (Evitar)
    statusTitle: 'Compatível',
    statusDescription: '',
    directMatches: [],
    cautionMatches: [],
    checkedRestrictions: []
  };

  // Avalia cada restrição ativa
  activeRestrictions.forEach(restrictionKey => {
    const allergen = ALLERGEN_DATABASE[restrictionKey];
    if (!allergen) return;

    results.checkedRestrictions.push(allergen.name);

    // Ordena termos diretos do maior para o menor para capturar expressões compostas primeiro
    // (ex: "creme de leite" antes de "leite", "pasta de amendoim" antes de "amendoim")
    const sortedKeywords = [...allergen.directKeywords].sort((a, b) => b.length - a.length);

    sortedKeywords.forEach(keyword => {
      if (containsTerm(normalizedDish, keyword)) {
        // Evita duplicar se uma expressão maior já engloba o termo
        const alreadyMatched = results.directMatches.some(
          m => m.restrictionKey === restrictionKey && normalizeText(m.matchedTerm).includes(normalizeText(keyword))
        );

        if (!alreadyMatched) {
          results.directMatches.push({
            restriction: allergen.name,
            restrictionKey: restrictionKey,
            icon: allergen.icon,
            matchedTerm: keyword
          });
        }
      }
    });

    // Checa palavras de atenção/possibilidades não confirmadas
    allergen.cautionKeywords.forEach(caution => {
      if (containsTerm(normalizedDish, caution.term)) {
        results.cautionMatches.push({
          restriction: allergen.name,
          icon: allergen.icon,
          term: caution.term,
          reason: caution.reason
        });
      }
    });
  });

  // Checa incertezas gerais
  GENERAL_UNCERTAINTIES.forEach(caution => {
    if (containsTerm(normalizedDish, caution.term)) {
      results.cautionMatches.push({
        restriction: 'Preparo Geral',
        icon: '⚠️',
        term: caution.term,
        reason: caution.reason
      });
    }
  });

  // Determina a classificação seguindo estritamente a hierarquia pedida:
  // 1. Ingrediente diretamente relacionado encontrado -> "Evitar"
  if (results.directMatches.length > 0) {
    results.status = 'danger';
    results.statusTitle = 'Evitar';
    results.statusDescription = 'Ingredientes diretamente relacionados às suas restrições selecionadas foram identificados neste prato.';
  }
  // 2. Possibilidade que não pode ser confirmada apenas pelo texto -> "Atenção"
  else if (results.cautionMatches.length > 0 || normalizedDish.length < 5) {
    results.status = 'warning';
    results.statusTitle = 'Atenção';
    results.statusDescription = 'Há possibilidades que não podem ser confirmadas apenas pelo texto informado. Recomenda-se cautela.';
    
    if (normalizedDish.length < 5 && results.cautionMatches.length === 0) {
      results.cautionMatches.push({
        restriction: 'Informação Insuficiente',
        icon: '❓',
        term: dishText,
        reason: 'A descrição fornecida é muito curta para descartar ingredientes ou contaminação no preparo.'
      });
    }
  }
  // 3. Nenhum ingrediente relacionado encontrado -> "Compatível"
  else {
    results.status = 'safe';
    results.statusTitle = 'Compatível';
    results.statusDescription = 'Nenhum ingrediente relacionado às restrições selecionadas foi encontrado no texto fornecido.';
  }

  // Identifica visualmente os ingredientes do prato
  results.identifiedIngredients = detectIngredients(dishText, activeRestrictions);

  return results;
}

// ==========================================================================
// Interface e Manipulação do DOM
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const formAnalise = document.getElementById('form-analise');
  const dishInput = document.getElementById('dish-input');
  const charCounter = document.getElementById('char-counter');
  const btnAnalisar = document.getElementById('btn-analisar');
  const btnLimparPrato = document.getElementById('btn-limpar-prato');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnClearRestrictions = document.getElementById('btn-clear-restrictions');
  const restrictionsFeedback = document.getElementById('restrictions-feedback');
  const placeholderState = document.getElementById('placeholder-state');
  const resultCardWrapper = document.getElementById('result-card-wrapper');
  const historyContainer = document.getElementById('history-container');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const historyControls = document.getElementById('history-controls');
  const historySearchInput = document.getElementById('history-search-input');
  const btnClearHistorySearch = document.getElementById('btn-clear-history-search');
  const historyFilterBtns = document.querySelectorAll('.history-filter-btn');

  // Estado dos filtros e busca do histórico
  let currentHistoryFilter = 'all';
  let currentHistorySearch = '';
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const restrictionCheckboxes = document.querySelectorAll('.restrictions-grid input[type="checkbox"]');
  const exampleChips = document.querySelectorAll('.chip-example');

  // Função para sincronizar a classe .selected nos cards de restrição (garante compatibilidade cross-browser sem depender de :has)
  function updateRestrictionCardVisual(checkbox) {
    if (!checkbox) return;
    const card = checkbox.closest('.restriction-card');
    if (card) {
      if (checkbox.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
  }

  // ==========================================================================
  // Gerenciamento de Tema (Modo Claro / Modo Escuro)
  // Ícones SVG minimalistas:
  // - Modo Escuro: Sol com círculo central vazado e 8 raios arredondados (referência visual)
  // - Modo Claro: Lua crescente no mesmo estilo minimalista
  // ==========================================================================
  const THEME_STORAGE_KEY = 'menusafe_theme';

  const SUN_ICON_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="theme-svg theme-svg-sun" aria-hidden="true"><circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="2.1" x2="12" y2="4.4"></line><line x1="12" y1="19.6" x2="12" y2="21.9"></line><line x1="2.1" y1="12" x2="4.4" y2="12"></line><line x1="19.6" y1="12" x2="21.9" y2="12"></line><line x1="5" y1="5" x2="6.63" y2="6.63"></line><line x1="17.37" y1="17.37" x2="19" y2="19"></line><line x1="5" y1="19" x2="6.63" y2="17.37"></line><line x1="17.37" y1="6.63" x2="19" y2="5"></line></svg>';

  const MOON_ICON_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="theme-svg theme-svg-moon" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.innerHTML = SUN_ICON_SVG;
      if (btnThemeToggle) {
        btnThemeToggle.setAttribute('aria-label', 'Alternar para Modo Claro');
        btnThemeToggle.setAttribute('title', 'Alternar para Modo Claro');
      }
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIcon) themeIcon.innerHTML = MOON_ICON_SVG;
      if (btnThemeToggle) {
        btnThemeToggle.setAttribute('aria-label', 'Alternar para Modo Escuro');
        btnThemeToggle.setAttribute('title', 'Alternar para Modo Escuro');
      }
    }

    try {
      safeStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Não foi possível salvar a preferência de tema:', e);
    }
  }

  // Inicializa com o tema salvo ou padrão claro
  try {
    const savedTheme = safeStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }
  } catch (e) {
    applyTheme('light');
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  // ==========================================================================
  // Sistema de Navegação por Páginas / Abas (Visualização Exclusiva)
  // ==========================================================================
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  const desktopNavLinks = document.querySelectorAll('.nav-link');
  const brandLink = document.querySelector('.brand-link');
  const heroCtaButtons = document.querySelectorAll('.hero-cta-group a[href^="#"]');
  const pageSections = document.querySelectorAll('.hero-section, .content-section');

  /**
   * Alterna a exibição entre as seções/páginas do aplicativo
   * Mantém apenas uma seção visível e atualiza o estado ativo de navegação
   * @param {string} targetId - ID da seção (ex: 'hero', 'restricoes', 'analisar', 'historico', 'sobre')
   * @param {boolean} [updateHistory=true] - Se deve atualizar o histórico/hash da URL
   */
  function navigateToPage(targetId, updateHistory = true) {
    if (!targetId) return;

    // Normaliza removendo '#' e espaços
    const cleanId = String(targetId).replace(/^#/, '').trim();
    if (!cleanId) return;

    const targetSection = document.getElementById(cleanId);
    if (!targetSection) return;

    // Oculta todas as seções e exibe APENAS a seção selecionada
    pageSections.forEach(section => {
      if (section.id === cleanId) {
        section.classList.add('active-page');
        section.removeAttribute('aria-hidden');
      } else {
        section.classList.remove('active-page');
        section.setAttribute('aria-hidden', 'true');
      }
    });

    // Atualiza links de navegação Desktop
    desktopNavLinks.forEach(link => {
      const linkHref = (link.getAttribute('href') || '').replace(/^#/, '');
      const isActive = linkHref === cleanId;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Atualiza links de navegação Mobile
    mobileNavLinks.forEach(link => {
      const linkHref = (link.getAttribute('href') || '').replace(/^#/, '');
      const isActive = linkHref === cleanId;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Fecha o menu móvel caso esteja aberto
    if (mobileNav && mobileNav.classList.contains('open')) {
      mobileNav.classList.remove('open');
      if (btnMobileMenu) {
        btnMobileMenu.classList.remove('active');
        btnMobileMenu.setAttribute('aria-expanded', 'false');
      }
      mobileNav.setAttribute('aria-hidden', 'true');
    }

    // Atualiza a URL sem causar rolagem padrão indesejada
    if (updateHistory) {
      try {
        if (window.history && typeof window.history.pushState === 'function') {
          window.history.pushState(null, '', '#' + cleanId);
        }
      } catch (e) {
        // Fallback defensivo em ambientes locais restritos (file://)
      }
    }

    // Posiciona o usuário no topo da nova página/seção
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      // Ignora falha em navegadores antigos
    }
  }

  // Controle de abertura/fechamento do botão hambúrguer mobile
  if (btnMobileMenu && mobileNav) {
    btnMobileMenu.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      btnMobileMenu.classList.toggle('active', isOpen);
      btnMobileMenu.setAttribute('aria-expanded', String(isOpen));
      mobileNav.setAttribute('aria-hidden', String(!isOpen));
    });
  }

  // Evento de clique para links de navegação desktop
  desktopNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      navigateToPage(targetId);
    });
  });

  // Evento de clique para links de navegação mobile
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      navigateToPage(targetId);
    });
  });

  // Evento de clique na marca/logo (retorna ao início)
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage('hero');
    });
  }

  // Evento de clique nos botões de CTA da tela inicial (Hero)
  heroCtaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('href');
      navigateToPage(targetId);
    });
  });

  // Suporte à navegação do histórico do navegador (Voltar / Avançar)
  window.addEventListener('popstate', () => {
    const hash = (window.location.hash || '').replace(/^#/, '');
    if (hash && document.getElementById(hash)) {
      navigateToPage(hash, false);
    } else {
      navigateToPage('hero', false);
    }
  });

  // Atualiza contador de caracteres
  if (dishInput && charCounter) {
    dishInput.addEventListener('input', () => {
      charCounter.textContent = dishInput.value.length;
      dishInput.classList.remove('input-error');
    });
  }

  // Tecla Enter no campo de prato (sem Shift) dispara a análise diretamente
  if (dishInput) {
    dishInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAnalysis();
      }
    });
  }

  // Botão Limpar Prato
  if (btnLimparPrato && dishInput && charCounter) {
    btnLimparPrato.addEventListener('click', () => {
      dishInput.value = '';
      charCounter.textContent = '0';
      dishInput.focus();
    });
  }

  // Inicialização: Assegura que todas as restrições comecem desmarcadas ao carregar/recarregar
  restrictionCheckboxes.forEach(cb => {
    cb.checked = false;
    updateRestrictionCardVisual(cb);
  });

  // Botões de Restrições (Marcar todas / Limpar)
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      restrictionCheckboxes.forEach(cb => {
        cb.checked = true;
        updateRestrictionCardVisual(cb);
      });
      if (restrictionsFeedback) restrictionsFeedback.textContent = '';
    });
  }

  btnClearRestrictions.addEventListener('click', () => {
    restrictionCheckboxes.forEach(cb => {
      cb.checked = false;
      updateRestrictionCardVisual(cb);
    });
    if (restrictionsFeedback) {
      restrictionsFeedback.textContent = 'Selecione pelo menos uma restrição para análise.';
    }
  });

  restrictionCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      updateRestrictionCardVisual(cb);
      const anyChecked = Array.from(restrictionCheckboxes).some(c => c.checked);
      if (anyChecked && restrictionsFeedback) {
        restrictionsFeedback.textContent = '';
      }
    });
  });

  // Chips de Exemplos Rápidos
  exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleText = chip.getAttribute('data-sample');
      if (sampleText && dishInput && charCounter) {
        dishInput.value = sampleText;
        charCounter.textContent = sampleText.length;
        handleAnalysis();
      }
    });
  });

  // Submissão do Formulário
  if (formAnalise) {
    formAnalise.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAnalysis();
    });
  }

  if (btnAnalisar) {
    btnAnalisar.addEventListener('click', (e) => {
      e.preventDefault();
      handleAnalysis();
    });
  }

  /**
   * Executa a análise e atualiza o estado
   */
  function handleAnalysis() {
    if (!dishInput) return;
    const text = dishInput.value.trim();
    const activeRestrictions = Array.from(restrictionCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    // Validação 1: Restrições selecionadas
    if (activeRestrictions.length === 0) {
      if (restrictionsFeedback) {
        restrictionsFeedback.textContent = '⚠️ Selecione pelo menos uma restrição antes de analisar.';
      }
      safeScrollIntoView(dishInput, { behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (restrictionsFeedback) {
      restrictionsFeedback.textContent = '';
    }

    // Validação 2: Texto do prato informado
    if (!text) {
      dishInput.focus();
      dishInput.classList.add('input-error');
      setTimeout(() => {
        dishInput.classList.remove('input-error');
      }, 1500);
      return;
    }

    // Feedback visual do botão
    if (btnAnalisar) {
      btnAnalisar.disabled = true;
    }
    const originalText = btnAnalisar ? btnAnalisar.innerHTML : '';
    if (btnAnalisar) {
      btnAnalisar.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Analisando...
      `;
    }

    setTimeout(() => {
      const analysis = analyzeDish(text, activeRestrictions);
      renderResult(analysis);
      saveToHistory(analysis);
      // Reseta busca e filtro para garantir a exibição imediata da nova análise
      currentHistorySearch = '';
      currentHistoryFilter = 'all';
      if (historySearchInput) historySearchInput.value = '';
      if (btnClearHistorySearch) btnClearHistorySearch.style.display = 'none';
      if (historyFilterBtns) {
        historyFilterBtns.forEach(b => {
          const isAll = b.getAttribute('data-filter') === 'all';
          b.classList.toggle('active', isAll);
          b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
        });
      }
      renderHistory();
      if (btnAnalisar) {
        btnAnalisar.disabled = false;
        btnAnalisar.innerHTML = originalText;
      }

      // Rolagem suave até a área de resultado
      if (resultCardWrapper) {
        safeScrollIntoView(resultCardWrapper, { behavior: 'smooth', block: 'nearest' });
      }
    }, 220);
  }

  /**
   * Renderiza visualmente o cartão com animação suave e os avisos necessários
   */
  function renderResult(data) {
    placeholderState.classList.add('hidden');
    resultCardWrapper.classList.remove('hidden');

    let statusClass = 'status-safe';
    let statusIcon = '✅';
    let statusBadgeText = 'Compatível';

    if (data.status === 'warning') {
      statusClass = 'status-warning';
      statusIcon = '⚠️';
      statusBadgeText = 'Atenção';
    } else if (data.status === 'danger') {
      statusClass = 'status-danger';
      statusIcon = '🚫';
      statusBadgeText = 'Evitar';
    }

    // Constrói lista de motivos e explicações
    let reasonsHtml = '';

    if (data.status === 'danger') {
      reasonsHtml += `
        <div class="result-reasons-title">
          <span>❌</span> Ingredientes relacionados detectados:
        </div>
        <ul class="reasons-list">
      `;
      data.directMatches.forEach(match => {
        reasonsHtml += `
          <li class="reason-item">
            <span class="reason-bullet">${match.icon}</span>
            <div>
              <strong>${match.restriction}:</strong> Detectado <span class="detected-tag">"${match.matchedTerm}"</span> no texto do prato.
            </div>
          </li>
        `;
      });
      if (data.cautionMatches.length > 0) {
        data.cautionMatches.forEach(caution => {
          reasonsHtml += `
            <li class="reason-item">
              <span class="reason-bullet">${caution.icon}</span>
              <div>
                <strong>${caution.restriction} (${caution.term}):</strong> ${caution.reason}
              </div>
            </li>
          `;
        });
      }
      reasonsHtml += `</ul>`;
    } else if (data.status === 'warning') {
      reasonsHtml += `
        <div class="result-reasons-title">
          <span>⚠️</span> Possibilidades que exigem confirmação:
        </div>
        <ul class="reasons-list">
      `;
      data.cautionMatches.forEach(caution => {
        reasonsHtml += `
          <li class="reason-item">
            <span class="reason-bullet">${caution.icon}</span>
            <div>
              <strong>${caution.restriction} (${caution.term}):</strong> ${caution.reason}
            </div>
          </li>
        `;
      });
      reasonsHtml += `</ul>`;
    } else {
      // Compatível (com pequeno aviso obrigatório)
      reasonsHtml += `
        <div class="result-reasons-title">
          <span>🌱</span> Avaliação de compatibilidade:
        </div>
        <ul class="reasons-list">
          <li class="reason-item">
            <span class="reason-bullet">✔️</span>
            <div>
              Nenhum ingrediente relacionado a <strong>${data.checkedRestrictions.join(', ')}</strong> foi encontrado no texto fornecido.
            </div>
          </li>
          <li class="reason-item">
            <span class="reason-bullet">⚠️</span>
            <div>
              <strong>Aviso:</strong> A informação fornecida não substitui a confirmação dos ingredientes e do modo de preparo diretamente com o estabelecimento ou cozinheiro.
            </div>
          </li>
        </ul>
      `;
    }

    // Constrói visual dos ingredientes identificados com imagens
    let ingredientsHtml = '';
    if (data.identifiedIngredients && data.identifiedIngredients.length > 0) {
      ingredientsHtml = `
        <div class="identified-ingredients-block">
          <div class="result-reasons-title">
            <span>🥗</span> Ingredientes identificados:
          </div>
          <div class="ingredients-grid">
            ${data.identifiedIngredients.map(ing => `
              <div class="ingredient-card status-${ing.statusClass}">
                <div class="ingredient-img-wrapper">
                  ${ing.imageUrl ? `
                    <img 
                      src="${ing.imageUrl}" 
                      alt="${escapeHtml(ing.name)}" 
                      class="ingredient-img" 
                      loading="lazy" 
                      onerror="this.style.display='none'; if (this.nextElementSibling) { this.nextElementSibling.style.display='flex'; }"
                    >
                    <div class="ingredient-fallback" style="display:none;" aria-hidden="true">${ing.fallbackIcon}</div>
                  ` : `
                    <div class="ingredient-fallback" aria-hidden="true">${ing.fallbackIcon}</div>
                  `}
                </div>
                <div class="ingredient-info">
                  <span class="ingredient-name">${escapeHtml(ing.name)}</span>
                  <span class="ingredient-badge badge-${ing.statusClass}">${escapeHtml(ing.badgeText)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Monta o template do cartão animado
    resultCardWrapper.innerHTML = `
      <div class="result-card ${statusClass}">
        <div class="result-header">
          <div class="status-icon-wrapper" aria-hidden="true">
            ${statusIcon}
          </div>
          <div class="status-title-group">
            <span class="status-badge">${statusBadgeText}</span>
            <h4 class="status-title">${data.statusTitle}</h4>
          </div>
        </div>

        <div class="analyzed-dish-info">
          <strong>Prato analisado:</strong> "${escapeHtml(data.dishName)}"
        </div>

        <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          ${data.statusDescription}
        </p>

        ${ingredientsHtml}

        ${reasonsHtml}
      </div>
    `;

    // Dispara animação suave de entrada forçando reflow limpo
    const cardEl = resultCardWrapper.querySelector('.result-card');
    if (cardEl) {
      cardEl.classList.remove('animate-entrance');
      void cardEl.offsetWidth; // Força repaint
      cardEl.classList.add('animate-entrance');
    }
  }

  /**
   * Escapa caracteres HTML por segurança
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================================================
  // Gerenciamento do Histórico de Análises em Memória (Sessão Volátil)
  // O histórico é mantido apenas temporariamente durante a navegação e reinicia zerado ao recarregar
  // ==========================================================================
  let sessionHistory = [];

  // Remove qualquer histórico persistido em versões anteriores no localStorage
  try {
    safeStorage.removeItem('menusafe_history');
  } catch (e) {
    // Silencioso
  }

  /**
   * Obtém a lista de análises da sessão atual em memória
   */
  function getHistory() {
    return Array.isArray(sessionHistory) ? sessionHistory : [];
  }

  /**
   * Salva uma nova análise no histórico temporário em memória
   */
  function saveToHistory(analysis) {
    try {
      const now = new Date();
      let dateStr = '';
      let timeStr = '';
      try {
        dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        const d = String(now.getDate()).padStart(2, '0');
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        dateStr = `${d}/${mo}`;
        timeStr = `${h}:${m}`;
      }

      let icon = '✅';
      if (analysis.status === 'warning') icon = '⚠️';
      else if (analysis.status === 'danger') icon = '🚫';

      const entry = {
        id: Date.now(),
        dishName: analysis.dishName,
        restrictions: [...analysis.checkedRestrictions],
        status: analysis.status,
        statusTitle: analysis.statusTitle,
        icon: icon,
        date: dateStr,
        time: timeStr
      };

      // Adiciona no início (mais recente primeiro)
      sessionHistory.unshift(entry);

      // Limita a 15 análises para uso eficiente de memória
      if (sessionHistory.length > 15) {
        sessionHistory.pop();
      }
    } catch (e) {
      console.warn('Não foi possível salvar no histórico temporário:', e);
    }
  }

  /**
   * Renderiza a listagem de pequenos cartões do histórico com filtro e busca em tempo real
   */
  function renderHistory() {
    if (!historyContainer) return;
    const history = getHistory();

    if (history.length === 0) {
      if (historyControls) {
        historyControls.style.display = 'none';
      }
      historyContainer.innerHTML = `
        <div class="history-empty">
          <span class="history-empty-icon" aria-hidden="true">📋</span>
          <p>Nenhuma análise no histórico ainda.</p>
          <span class="history-empty-sub">As análises que você fizer aparecerão salvas aqui.</span>
        </div>
      `;
      return;
    }

    if (historyControls) {
      historyControls.style.display = 'flex';
    }

    const query = normalizeText(currentHistorySearch.trim());

    // Filtra pelo status selecionado e pelo termo de busca
    const filteredHistory = history.filter(item => {
      // 1. Filtro rápido de status (Todos, Compatíveis, Atenção, Evitar)
      if (currentHistoryFilter !== 'all' && item.status !== currentHistoryFilter) {
        return false;
      }

      // 2. Busca por texto (nome do prato ou restrições avaliadas)
      if (query) {
        const dishMatch = normalizeText(item.dishName).includes(query);
        const restrictionsMatch = Array.isArray(item.restrictions) && item.restrictions.some(r => normalizeText(r).includes(query));
        const statusMatch = normalizeText(item.statusTitle || '').includes(query);
        if (!dishMatch && !restrictionsMatch && !statusMatch) {
          return false;
        }
      }

      return true;
    });

    // Se houver histórico salvo, mas nenhum item coincidir com o filtro ou busca
    if (filteredHistory.length === 0) {
      historyContainer.innerHTML = `
        <div class="history-empty">
          <span class="history-empty-icon" aria-hidden="true">🔍</span>
          <p>Nenhum histórico encontrado para esta busca.</p>
          <span class="history-empty-sub">Tente buscar por outro prato ou clique em outro filtro acima.</span>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = filteredHistory.map(item => {
      let badgeClass = 'safe';
      if (item.status === 'warning') badgeClass = 'warning';
      else if (item.status === 'danger') badgeClass = 'danger';

      const restrictionsHtml = item.restrictions && item.restrictions.length > 0
        ? item.restrictions.map(r => `<span class="history-chip">${escapeHtml(r)}</span>`).join('')
        : '<span class="history-chip">Nenhuma</span>';

      const formattedTime = item.date ? (item.time ? `${item.date} às ${item.time}` : item.date) : (item.time || '');

      return `
        <div class="history-item status-${item.status}" data-dish="${escapeHtml(item.dishName)}" title="Clique para recarregar este prato no campo">
          <div class="history-item-top">
            <span class="history-badge ${badgeClass}">
              <span>${item.icon || '🔍'}</span> ${escapeHtml(item.statusTitle)}
            </span>
            <span class="history-time">${escapeHtml(formattedTime)}</span>
          </div>
          <div class="history-dish-name">${escapeHtml(item.dishName)}</div>
          <div class="history-restrictions-row">
            <span>Restrições:</span>
            ${restrictionsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Permite que o usuário clique em um item do histórico para recarregar o texto no campo
    const cards = historyContainer.querySelectorAll('.history-item');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const dish = card.getAttribute('data-dish');
        if (dish && dishInput) {
          dishInput.value = dish;
          if (charCounter) charCounter.textContent = dish.length;
          navigateToPage('analisar');
          safeScrollIntoView(dishInput, { behavior: 'smooth', block: 'center' });
          dishInput.focus();
        }
      });
    });
  }

  // Eventos de Busca em Tempo Real no Histórico
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      currentHistorySearch = e.target.value || '';
      if (btnClearHistorySearch) {
        btnClearHistorySearch.style.display = currentHistorySearch ? 'inline-flex' : 'none';
      }
      renderHistory();
    });
  }

  if (btnClearHistorySearch) {
    btnClearHistorySearch.addEventListener('click', () => {
      if (historySearchInput) {
        historySearchInput.value = '';
        currentHistorySearch = '';
        btnClearHistorySearch.style.display = 'none';
        historySearchInput.focus();
      }
      renderHistory();
    });
  }

  // Eventos dos Botões de Filtro Rápido no Histórico
  if (historyFilterBtns && historyFilterBtns.length > 0) {
    historyFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filterVal = btn.getAttribute('data-filter') || 'all';
        currentHistoryFilter = filterVal;

        historyFilterBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        renderHistory();
      });
    });
  }

  // Botão Limpar Histórico
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      sessionHistory = [];
      try {
        safeStorage.removeItem('menusafe_history');
      } catch (e) {
        // Silencioso
      }
      currentHistorySearch = '';
      currentHistoryFilter = 'all';
      if (historySearchInput) historySearchInput.value = '';
      if (btnClearHistorySearch) btnClearHistorySearch.style.display = 'none';
      if (historyFilterBtns) {
        historyFilterBtns.forEach(b => {
          const isAll = b.getAttribute('data-filter') === 'all';
          b.classList.toggle('active', isAll);
          b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
        });
      }
      renderHistory();
    });
  }

  // Inicializa a renderização do histórico existente na carga da página
  renderHistory();

  // Inicialização do sistema de abas: garante que ao carregar exiba apenas a seção de Início (Hero)
  navigateToPage('hero', false);
});
