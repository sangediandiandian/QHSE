export function normalizeRoutePath(path: string) {
  return path
    .split('/')
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part) || /^\d+$/.test(part) ? ':id' : part,
    )
    .join('/');
}
