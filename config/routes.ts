/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路径增加 layout 组件时使用。
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置路由的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn， 注意去除风格后缀和大小写，如想要配置图标为 <StepBackwardOutlined /> 则取值应为 stepBackward 或 StepBackward，如想要配置图标为 <UserOutlined /> 则取值应为 user 或者 User
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './User/Login',
      },
    ],
  },
  {
    path: '/dashboard',
    name: '综合驾驶舱',
    icon: 'dashboard',
    component: './Dashboard',
  },
  {
    path: '/screen',
    component: './BigScreen',
    layout: false,
    hideInMenu: true,
  },
  {
    path: '/management',
    name: 'QHSE 管理',
    icon: 'safetyCertificate',
    routes: [
      {
        path: '/management',
        redirect: '/management/risks',
      },
      {
        path: '/management/risks',
        name: '风险分级',
        access: 'canViewRisk',
        component: './RiskManagement',
      },
      {
        path: '/management/hazards',
        name: '隐患治理',
        access: 'canViewHazard',
        component: './HazardManagement',
      },
      {
        path: '/management/permits',
        name: '作业许可',
        access: 'canViewPermit',
        component: './WorkPermit',
      },
    ],
  },
  {
    path: '/monitoring',
    name: '监测中心',
    icon: 'radarChart',
    routes: [
      {
        path: '/monitoring',
        redirect: '/dashboard',
      },
      {
        path: '/monitoring/gds',
        name: 'GDS 监测',
        component: './Monitoring/GDS',
      },
      {
        path: '/monitoring/voc',
        name: 'VOC 监测',
        component: './Monitoring/VOC',
      },
      {
        path: '/monitoring/mes',
        name: 'MES 关联',
        component: './Monitoring/MES',
      },
    ],
  },
  {
    name: '综合预警',
    icon: 'alert',
    path: '/warnings',
    component: './WarningCenter',
  },
  {
    name: '预警规则',
    icon: 'control',
    path: '/rules',
    access: 'canViewWarningRule',
    component: './WarningRules',
  },
  {
    name: '融合通信',
    icon: 'phone',
    path: '/communication',
    component: './Communication',
  },
  {
    name: '应急指挥',
    icon: 'deploymentUnit',
    path: '/emergency',
    component: './EmergencyCommand',
  },
  {
    name: '应急预案',
    icon: 'fileProtect',
    path: '/plans',
    component: './EmergencyPlans',
    access: 'canViewPlan',
  },
  {
    name: '应急资源',
    icon: 'car',
    path: '/resources',
    component: './EmergencyResources',
  },
  {
    name: '事件闭环',
    icon: 'partition',
    path: '/events',
    component: './EventLifecycle',
    access: 'canViewEmergency',
  },
  {
    name: '事件复盘',
    icon: 'audit',
    path: '/reviews',
    component: './EventReviews',
  },
  {
    path: '/warnings/:id',
    component: './WarningDetail',
    hideInMenu: true,
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '*',
    layout: false,
    component: './404',
  },
];
