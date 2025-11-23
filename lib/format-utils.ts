// Format utilities for dates and request numbers

export function formatRequestNumber(number: number, type: 'PP' | 'Client'): string {
  return `${type}_${number}`;
}

export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formate un prix en euros avec séparateurs de milliers
 * Exemple: 5938 -> "5 938 €"
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) {
    return 'N/A';
  }
  if (price === 0) {
    return 'N/A';
  }
  // Formater avec espace comme séparateur de milliers (format français)
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + ' €';
}



