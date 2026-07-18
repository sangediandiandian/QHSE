import access from './access';

describe('access', () => {
  it('grants all protected capabilities to a legacy admin', () => {
    const permissions = access({
      currentUser: {
        userid: 'admin',
        access: 'admin',
      },
    });

    expect(permissions.canAdmin).toBe(true);
    expect(permissions.canViewRisk).toBe(true);
    expect(permissions.canViewTelemetry).toBe(true);
    expect(permissions.canManageEmergency).toBe(true);
    expect(permissions.canExportReport).toBe(true);
    expect(permissions.hasPermission('any:future-permission')).toBe(true);
  });

  it('only grants explicitly assigned capabilities to a regular user', () => {
    const permissions = access({
      currentUser: {
        userid: 'operator',
        permissions: ['risk:read', 'hazard:report'],
      },
    });

    expect(permissions.canViewRisk).toBe(true);
    expect(permissions.canReportHazard).toBe(true);
    expect(permissions.canAssessRisk).toBe(false);
    expect(permissions.canViewPermit).toBe(false);
    expect(permissions.hasPermission('risk:read')).toBe(true);
    expect(permissions.hasPermission('risk:assess')).toBe(false);
  });

  it('denies protected capabilities when there is no authenticated user', () => {
    const permissions = access(undefined);

    expect(permissions.canAdmin).toBe(false);
    expect(permissions.canViewRisk).toBe(false);
    expect(permissions.canHandleWarning).toBe(false);
    expect(permissions.hasPermission('risk:read')).toBe(false);
  });
});
