export function groupByFilePath<T>(
  items: T[],
  getFilePath: (item: T) => string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const filePath = getFilePath(item);
    const existing = grouped.get(filePath);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(filePath, [item]);
    }
  }
  return grouped;
}
