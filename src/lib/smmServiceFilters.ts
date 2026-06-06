export interface SmmService {
  service_id: string;
  name: string;
  category: string;
  rate: number | string;
  min: number | string;
  max: number | string;
  is_active: boolean;
  show_in_popular: boolean;
  is_featured: boolean;
  image_url?: string | null;
}

/**
 * Returns the correct slice of services for a given tab.
 * - "Popular Services": active + show_in_popular, sorted by rate asc
 * - Category tab:       active + matching category
 * - null (all):         active only
 */
export function getFilteredServices(
  services: SmmService[],
  activeCategory: string | null,
  searchQuery = '',
): SmmService[] {
  let filtered: SmmService[];

  if (activeCategory === 'Popular Services') {
    filtered = [...services]
      .filter(s => s.is_active && s.show_in_popular)
      .sort((a, b) => Number(a.rate) - Number(b.rate));
  } else if (activeCategory) {
    filtered = services.filter(s => s.is_active && s.category === activeCategory);
  } else {
    filtered = services.filter(s => s.is_active);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        String(s.service_id).toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }

  return filtered;
}

/** Featured services for optional hero/banner sections. */
export function getFeaturedServices(services: SmmService[]): SmmService[] {
  return services.filter(s => s.is_active && s.is_featured);
}
