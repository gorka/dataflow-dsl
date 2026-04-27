export function getSuggestions(parentFields: string[], input: string): string[] {
  const prefix = input.includes('.') ? input.slice(0, input.lastIndexOf('.') + 1) : '';
  const partial = input.slice(prefix.length);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of parentFields) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const segment = rest.split('.')[0];
    if (!segment || seen.has(segment)) continue;
    if (partial && !segment.startsWith(partial)) continue;
    seen.add(segment);
    result.push(segment);
  }
  return result;
}

export function hasChildren(parentFields: string[], path: string): boolean {
  const prefix = path + '.';
  return parentFields.some(p => p.startsWith(prefix));
}

export function getBranchPaths(parentFields: string[], suggestions: string[], prefix: string): Set<string> {
  const set = new Set<string>();
  for (const s of suggestions) {
    if (hasChildren(parentFields, prefix + s)) set.add(s);
  }
  return set;
}

export function getSuggestionPrefix(value: string): string {
  return value.includes('.') ? value.slice(0, value.lastIndexOf('.') + 1) : '';
}
