interface Dated {
  id: string;
  updatedAt: number;
}

export function groupByDate<T extends Dated>(items: T[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

  const groups: { label: string; items: T[] }[] = [
    { label: 'Hoje', items: [] },
    { label: 'Últimos 7 dias', items: [] },
    { label: 'Mais antigas', items: [] },
  ];

  for (const item of items) {
    if (item.updatedAt >= startOfToday) groups[0].items.push(item);
    else if (item.updatedAt >= sevenDaysAgo) groups[1].items.push(item);
    else groups[2].items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
}
