import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit.decorator';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CreateUserDto, UpdateUserAuthorizationDto } from './iam.dto';
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

  @Get('users')
  @ApiOperation({ summary: '查询用户及授权信息' })
  listUsers() {
    return this.iamService.listUsers();
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
