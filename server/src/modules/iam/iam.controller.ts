import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/permissions.decorator';
import { IamService } from './iam.service';

@ApiTags('组织与权限')
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
}
