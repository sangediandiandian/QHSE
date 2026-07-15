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
    canViewHazard: Boolean(currentUser && (isLegacyAdmin || granted.has('hazard:read'))),
    canReportHazard: Boolean(currentUser && (isLegacyAdmin || granted.has('hazard:report'))),
    canRectifyHazard: Boolean(currentUser && (isLegacyAdmin || granted.has('hazard:rectify'))),
    canAcceptHazard: Boolean(currentUser && (isLegacyAdmin || granted.has('hazard:accept'))),
    canSuperviseHazard: Boolean(currentUser && (isLegacyAdmin || granted.has('hazard:supervise'))),
    canViewPermit: Boolean(currentUser && (isLegacyAdmin || granted.has('permit:read'))),
    canApplyPermit: Boolean(currentUser && (isLegacyAdmin || granted.has('permit:apply'))),
    canApprovePermit: Boolean(currentUser && (isLegacyAdmin || granted.has('permit:approve'))),
    canConfirmPermit: Boolean(currentUser && (isLegacyAdmin || granted.has('permit:confirm'))),
    canControlPermit: Boolean(currentUser && (isLegacyAdmin || granted.has('permit:control'))),
    canViewWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:read'))),
    canEditWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:edit'))),
    canSubmitWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:submit'))),
    canApproveWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:approve'))),
    canToggleWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:toggle'))),
    canReadAudit: Boolean(currentUser && (isLegacyAdmin || granted.has('audit:read'))),
    hasPermission: (permission: string) => Boolean(currentUser && (
      isLegacyAdmin || granted.has(permission)
    )),
  };
}
