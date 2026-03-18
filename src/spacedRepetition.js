/**
 * Sistema de Repetição Espaçada baseado no algoritmo SuperMemo SM-2
 * 
 * Fator de Facilidade (Ease Factor - EF): 
 * - Começa em 2.5
 * - Ajustado com base na performance
 * 
 * Intervalos:
 * - Primeira revisão: 1 dia
 * - Segunda revisão: 6 dias
 * - Próximas: intervalo anterior * EF
 */

export class SpacedRepetitionSystem {
  constructor() {
    this.MIN_EF = 1.3;
    this.DEFAULT_EF = 2.5;
  }

  /**
   * Inicializa dados de repetição para um item
   * @returns {Object} Dados iniciais de SRS
   */
  initializeItem() {
    return {
      easeFactor: this.DEFAULT_EF,
      interval: 0,
      repetitions: 0,
      nextReview: new Date().toISOString().split('T')[0],
      lastReview: null,
      reviews: []
    };
  }

  /**
   * Calcula próxima revisão baseado na performance
   * @param {Object} item - Item com dados de SRS
   * @param {number} quality - Qualidade da resposta (0-5)
   *   5: Perfeito
   *   4: Correto com hesitação
   *   3: Correto com dificuldade
   *   2: Errado mas lembrou
   *   1: Errado mas familiar
   *   0: Completamente esquecido
   * @returns {Object} Item atualizado
   */
  reviewItem(item, quality) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Copiar item para não mutar
    const updated = { ...item };

    // Registrar revisão
    updated.reviews = updated.reviews || [];
    updated.reviews.push({
      date: now.toISOString(),
      quality: quality,
      interval: updated.interval
    });

    updated.lastReview = today;

    // Se qualidade < 3, reiniciar
    if (quality < 3) {
      updated.repetitions = 0;
      updated.interval = 0;
    } else {
      updated.repetitions += 1;

      // Calcular novo intervalo
      if (updated.repetitions === 1) {
        updated.interval = 1;
      } else if (updated.repetitions === 2) {
        updated.interval = 6;
      } else {
        updated.interval = Math.round(updated.interval * updated.easeFactor);
      }
    }

    // Atualizar fator de facilidade
    updated.easeFactor = Math.max(
      this.MIN_EF,
      updated.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    // Calcular próxima data de revisão
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + updated.interval);
    updated.nextReview = nextDate.toISOString().split('T')[0];

    return updated;
  }

  /**
   * Obtém itens que precisam ser revisados hoje
   * @param {Array} items - Lista de itens
   * @param {string} today - Data de hoje (YYYY-MM-DD)
   * @returns {Array} Itens para revisar
   */
  getItemsDueToday(items, today = null) {
    const compareDate = today || new Date().toISOString().split('T')[0];
    
    return items.filter(item => {
      const srs = item.spacedRepetition || this.initializeItem();
      return srs.nextReview <= compareDate;
    }).sort((a, b) => {
      // Priorizar por data de revisão (mais antigos primeiro)
      const dateA = a.spacedRepetition?.nextReview || '9999-12-31';
      const dateB = b.spacedRepetition?.nextReview || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  }

  /**
   * Calcula estatísticas de progresso
   * @param {Array} items - Lista de itens
   * @returns {Object} Estatísticas
   */
  getStatistics(items) {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = {
      total: items.length,
      dueToday: 0,
      overdue: 0,
      upcoming: 0,
      mastered: 0, // 5+ repetições corretas
      learning: 0, // 1-4 repetições
      new: 0, // 0 repetições
      averageEF: 0,
      totalReviews: 0
    };

    let totalEF = 0;

    items.forEach(item => {
      const srs = item.spacedRepetition || this.initializeItem();
      
      totalEF += srs.easeFactor;
      stats.totalReviews += (srs.reviews || []).length;

      if (srs.nextReview < today) {
        stats.overdue++;
      } else if (srs.nextReview === today) {
        stats.dueToday++;
      } else {
        stats.upcoming++;
      }

      if (srs.repetitions === 0) {
        stats.new++;
      } else if (srs.repetitions >= 5) {
        stats.mastered++;
      } else {
        stats.learning++;
      }
    });

    stats.averageEF = items.length > 0 ? (totalEF / items.length).toFixed(2) : 0;

    return stats;
  }
}
