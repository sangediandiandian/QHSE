/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(initialState: { currentUser?: API.CurrentUser } | undefined) {
  const { currentUser } = initialState ?? {};
  const granted = new Set(currentUser?.permissions ?? []);
  const isLegacyAdmin = currentUser?.access === 'admin';
  return {
    canAdmin: Boolean(currentUser && (isLegacyAdmin || granted.has('iam:manage'))),
    canViewRisk: Boolean(currentUser && (isLegacyAdmin || granted.has('risk:read'))),
    canAssessRisk: Boolean(currentUser && (isLegacyAdmin || granted.has('risk:assess'))),
    canUpdateRiskControls: Boolean(currentUser && (
      isLegacyAdmin || granted.has('risk:controls:update')
    )),
    canReadAudit: Boolean(currentUser && (isLegacyAdmin || granted.has('audit:read'))),
    hasPermission: (permission: string) => Boolean(currentUser && (
      isLegacyAdmin || granted.has(permission)
    )),
  };
}
