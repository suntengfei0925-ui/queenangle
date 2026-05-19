# QueenAngle AI 接手说明

QueenAngle 是一个门店使用的手机网页系统，用来记录会员消费、散客结账、会员充值/购卡、服务项目配置和账本记录。

## 项目位置

- 本地代码：`D:\queenangle`
- 前端页面：`web/`
- 后端服务：`server/`
- 运维脚本：`scripts/`
- 项目文档：`docs/`

## 功能入口

- 打开网站后先登录。
- 底部“记一笔”：进入会员相关操作或散客结账。
- 会员入口：搜索会员、新建会员、进入会员详情。
- 会员详情：编辑会员、会员结账、购卡/充值、查看历史记录。
- 散客结账：选择服务人、消费项目、支付方式，保存一条不绑定会员的记录。
- 底部“账本”：查看今日汇总和今日记录，点击记录进入详情。
- 记录详情：查看消费/充值/购卡明细、客户签名、作废记录。
- 底部“设置”：维护服务分类、服务项目、充值档位、次卡类型，也可以退出登录。

## 代码入口

- `web/index.html`：页面结构、按钮、各个功能视图。
- `web/app.js`：前端页面切换、按钮动作、数据请求。
- `web/styles.css`：页面样式。
- `server/index.js`：后端 HTTP 接口入口、登录接口、业务接口、静态页面服务。
- `server/business/index.js`：会员、结账、充值、购卡、记录、作废等业务逻辑。
- `server/files/routes.js`：签名图片和文件上传/读取。
- `server/db/`：SQLite 数据读写封装。

## 线上环境

- 生产访问地址：`http://47.100.52.163/`
- 服务器 IP：`47.100.52.163`
- SSH 用户：`admin`
- SSH key：`D:\queenangle\.temp\queenangle_deploy_ed25519`
- 线上当前代码：`/opt/queenangle/current`
- 线上 release 目录：`/opt/queenangle/releases`
- 线上数据目录：`/var/lib/queenangle`
- 数据库文件：`/var/lib/queenangle/db/queenangle.sqlite`
- 上传文件目录：`/var/lib/queenangle/uploads`
- 环境变量文件：`/etc/queenangle.env`
- 部署脚本：`scripts/deploy-prod.ps1`

## 接手时先看哪里

- 页面、点击、显示问题：先看 `web/index.html`、`web/app.js`、`web/styles.css`。
- 登录、接口、页面加载问题：先看 `server/index.js`。
- 会员、结账、充值、购卡、作废、账本数据问题：先看 `server/business/index.js`。
- 签名或上传图片问题：先看 `server/files/routes.js`。
- 线上部署或运行状态问题：先看 `scripts/deploy-prod.ps1`，并结合 `queenangle-deploy` skill。
