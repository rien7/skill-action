const actionUriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

export function isRuntimeGlobalActionReference(actionId: string): boolean {
  return (
    actionUriSchemePattern.test(actionId) ||
    actionId.startsWith("/") ||
    actionId.startsWith("./") ||
    actionId.startsWith("../")
  );
}
