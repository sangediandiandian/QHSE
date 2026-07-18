import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import {
  CreateRoleDto,
  CreateUserDto,
  ReviewAuthorizationRequestDto,
  SubmitAuthorizationRequestDto,
  UpdateRoleDto,
  UpdateUserAuthorizationDto,
} from './iam.dto';
import { IamService } from './iam.service';
import type { AuthPrincipal } from './iam.types';

@ApiTags('组织与权限')
@ApiBearerAuth()
@Controller('v1/iam')
@RequirePermissions('iam:read')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('organizations')
  @ApiOperation({ summary: '查询组织与区域树' })
  listOrganizations() {
    return this.iamService.listOrganizations();
  }

  @Get('roles')
  @ApiOperation({ summary: '查询角色权限矩阵' })
  listRoles() {
    return this.iamService.listRoles();
  }

  @Post('roles')
  @RequirePermissions('iam:manage')
  @AuditAction({ action: 'iam.role.create', resourceType: 'iam_role' })
  @ApiOperation({ summary: '创建自定义角色' })
  createRole(@Body() input: CreateRoleDto) {
    return this.iamService.createRole(input);
  }

  @Put('roles/:id')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.role.update',
    resourceType: 'iam_role',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '更新自定义角色权限矩阵和数据范围' })
  updateRole(@Param('id') id: string, @Body() input: UpdateRoleDto) {
    return this.iamService.updateRole(id, input);
  }

  @Get('users')
  @ApiOperation({ summary: '查询用户及授权信息' })
  listUsers() {
    return this.iamService.listUsers();
  }

  @Get('authorization-requests')
  @RequirePermissions('iam:manage')
  @ApiOperation({ summary: '查询用户授权变更审批台账' })
  listAuthorizationRequests() {
    return this.iamService.listAuthorizationRequests();
  }

  @Post('users/:id/authorization-requests')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.authorization.request',
    resourceType: 'iam_user',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '提交用户授权变更申请' })
  submitAuthorizationRequest(
    @Param('id') id: string,
    @Body() input: SubmitAuthorizationRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.iamService.submitAuthorizationRequest(id, input, principal);
  }

  @Put('authorization-requests/:id/review')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.authorization.review',
    resourceType: 'iam_authorization_request',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '异人审批用户授权变更并原子应用授权' })
  reviewAuthorizationRequest(
    @Param('id') id: string,
    @Body() input: ReviewAuthorizationRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.iamService.reviewAuthorizationRequest(id, input, principal);
  }

  @Post('users')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.user.create',
    resourceType: 'iam_user',
    includeUsername: true,
  })
  @ApiOperation({ summary: '创建用户并分配初始角色与区域数据权限' })
  createUser(@Body() input: CreateUserDto) {
    return this.iamService.createUser(input);
  }

  @Put('users/:id/authorization')
  @RequirePermissions('iam:manage')
  @AuditAction({
    action: 'iam.user.authorization.update',
    resourceType: 'iam_user',
    resourceIdParam: 'id',
  })
  @ApiOperation({ summary: '更新用户状态、组织、角色和区域数据权限' })
  updateUserAuthorization(
    @Param('id') id: string,
    @Body() input: UpdateUserAuthorizationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.iamService.updateUserAuthorization(id, input, principal.userId);
  }
}
