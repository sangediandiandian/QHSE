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
    canUpdateRiskControls: Boolean(
      currentUser && (isLegacyAdmin || granted.has('risk:controls:update')),
    ),
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
    canApproveWarningRule: Boolean(
      currentUser && (isLegacyAdmin || granted.has('warning:approve')),
    ),
    canToggleWarningRule: Boolean(currentUser && (isLegacyAdmin || granted.has('warning:toggle'))),
    canEvaluateWarningRule: Boolean(
      currentUser && (isLegacyAdmin || granted.has('warning:evaluate')),
    ),
    canViewEmergency: Boolean(currentUser && (isLegacyAdmin || granted.has('emergency:read'))),
    canManageEmergency: Boolean(currentUser && (isLegacyAdmin || granted.has('emergency:manage'))),
    canAddEmergencyEvidence: Boolean(
      currentUser && (isLegacyAdmin || granted.has('emergency:evidence')),
    ),
    canApproveEmergencyClosure: Boolean(
      currentUser && (isLegacyAdmin || granted.has('emergency:approve')),
    ),
    canViewPlan: Boolean(currentUser && (isLegacyAdmin || granted.has('plan:read'))),
    canEditPlan: Boolean(currentUser && (isLegacyAdmin || granted.has('plan:edit'))),
    canSubmitPlan: Boolean(currentUser && (isLegacyAdmin || granted.has('plan:submit'))),
    canApprovePlan: Boolean(currentUser && (isLegacyAdmin || granted.has('plan:approve'))),
    canManageDrill: Boolean(currentUser && (isLegacyAdmin || granted.has('plan:drill'))),
    canViewResource: Boolean(currentUser && (isLegacyAdmin || granted.has('resource:read'))),
    canManageResource: Boolean(currentUser && (isLegacyAdmin || granted.has('resource:manage'))),
    canDispatchResource: Boolean(
      currentUser && (isLegacyAdmin || granted.has('resource:dispatch')),
    ),
    canInspectResource: Boolean(currentUser && (isLegacyAdmin || granted.has('resource:inspect'))),
    canViewCommunication: Boolean(
      currentUser && (isLegacyAdmin || granted.has('communication:read')),
    ),
    canSendCommunication: Boolean(
      currentUser && (isLegacyAdmin || granted.has('communication:send')),
    ),
    canConfirmCommunication: Boolean(
      currentUser && (isLegacyAdmin || granted.has('communication:confirm')),
    ),
    canViewTelemetry: Boolean(currentUser && (isLegacyAdmin || granted.has('telemetry:read'))),
    canIngestTelemetry: Boolean(currentUser && (isLegacyAdmin || granted.has('telemetry:ingest'))),
    canReadAttachment: Boolean(currentUser && (isLegacyAdmin || granted.has('attachment:read'))),
    canUploadAttachment: Boolean(
      currentUser && (isLegacyAdmin || granted.has('attachment:upload')),
    ),
    canViewReport: Boolean(currentUser && (isLegacyAdmin || granted.has('report:read'))),
    canExportReport: Boolean(currentUser && (isLegacyAdmin || granted.has('report:export'))),
    canReadAudit: Boolean(currentUser && (isLegacyAdmin || granted.has('audit:read'))),
    hasPermission: (permission: string) =>
      Boolean(currentUser && (isLegacyAdmin || granted.has(permission))),
  };
}
