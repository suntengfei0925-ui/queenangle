# QueenAngle 独立网站迁移与服务器部署方案

## 1. 迁移目标

当前项目已经完成了核心业务逻辑。本次不是重做产品，而是把现有微信小程序/云开发运行框架替换为独立网站运行框架。

目标形态：

```text
手机浏览器访问你的域名
→ 老板/老板娘登录
→ 使用现有记账、会员、充值、次卡、签名、流水、作废等业务逻辑
→ 数据保存在自己的服务器
```

明确不再依赖：

- 微信小程序
- 微信云开发
- 微信云函数
- 微信云数据库
- openid 白名单
- 微信审核或微信登录

继续保留：

- 现有业务规则
- 现有 action 调用模式
- 现有金额以分保存的规则
- 线下支付方式记录
- 支付二维码展示逻辑
- 客户签名功能

## 2. 已确认业务边界

- 只给自己店使用，不做多商户 SaaS。
- 短期只有两个人使用：老板和老板娘。
- 没有历史数据需要迁移。
- 迁移时没有旧签名图片需要迁移。
- 未来网站中仍然要保留客户签名功能。
- 手机优先，没有电脑后台优先需求。
- 支付不接真实支付接口，只记录线下收款方式并展示二维码。

支付方式的含义保持不变：

```text
wechat = 线下微信收款记录/二维码展示
alipay = 线下支付宝收款记录/二维码展示
cash = 现金
```

这里的 `wechat` 只是业务命名，不代表系统接入微信支付。

## 3. 推荐服务器架构

2G 服务器推荐轻量架构：

```text
浏览器
  ↓ HTTPS
Caddy 或 Nginx
  ↓ reverse proxy
Node.js API 服务
  ↓
SQLite 数据库
  ↓
本地签名/图片文件目录
```

推荐第一版使用：

- 操作系统：Ubuntu 22.04 LTS 或 Ubuntu 24.04 LTS
- Web 入口：Caddy，自动 HTTPS，配置更简单
- 后端：Node.js 20 LTS
- 数据库：SQLite
- 进程管理：systemd
- 文件存储：服务器本地目录
- 备份：每日备份 SQLite 数据库和上传文件

第一版不建议：

- Docker 全家桶
- Kubernetes
- 多服务拆分
- PostgreSQL/MariaDB，除非后续要多门店或多人高并发
- 把上传目录直接开放成无鉴权静态目录

## 4. 目录规划

建议服务器目录固定如下：

```text
/opt/queenangle/app          后端服务代码
/opt/queenangle/web          前端静态文件
/var/lib/queenangle/db       SQLite 数据库
/var/lib/queenangle/uploads  签名图片和后续上传文件
/var/backups/queenangle      本机备份
/etc/queenangle.env          生产环境变量
```

服务运行用户建议使用独立用户：

```text
queenangle
```

不要用 `root` 直接运行 Node 服务。

## 5. 域名与网络要求

服务器需要准备：

- 域名已经解析到服务器公网 IP。
- 开放 80 和 443 端口。
- SSH 端口只允许自己常用 IP 更安全。
- 网站正式入口只使用 HTTPS。

建议域名形态：

```text
https://your-domain.com
```

如果后续希望区分 API，也可以：

```text
https://your-domain.com
https://api.your-domain.com
```

第一版建议前后端同域部署，减少 Cookie、跨域和 CSRF 复杂度：

```text
https://your-domain.com
https://your-domain.com/api/*
```

## 6. 安全方案

账号方案：

- 只创建两个账号：老板、老板娘。
- 不开放注册。
- 不提供公开找回密码。
- 初始账号通过服务器命令或初始化脚本创建。
- 后续可以在系统内修改密码。

密码与会话：

- 密码只保存哈希，不保存明文。
- 推荐 `argon2id`，最低也要使用 `bcrypt`。
- 登录成功后使用服务端会话。
- 浏览器保存 `HttpOnly + Secure + SameSite` Cookie。
- 不把 token 放在 `localStorage`。
- 登录接口加限流。
- 修改密码后让旧会话失效。

建议 Cookie：

```text
HttpOnly
Secure
SameSite=Lax 或 Strict
```

服务端必须配置强随机密钥：

```text
SESSION_SECRET=至少 32 字节随机字符串
```

敏感操作建议进入审计日志：

- 登录成功/失败
- 新增/编辑会员
- 充值
- 消费
- 购买/核销次卡
- 作废记录
- 修改设置
- 修改密码

## 7. 业务逻辑迁移策略

迁移原则：

```text
保留业务函数
替换微信运行时
用适配层模拟云数据库 API
```

现有核心逻辑来源：

```text
cloudfunctions/business/index.js
```

不要一开始把所有业务逻辑改写成全新 REST API。第一版继续保留 action 模式：

```http
POST /api/business
Content-Type: application/json

{
  "action": "createMemberCheckout",
  "...": "..."
}
```

服务端返回结构继续保持：

```json
{
  "ok": true,
  "data": {}
}
```

错误结构继续保持：

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "错误提示"
}
```

这样可以最大化复用现有页面和业务调用习惯。

## 8. 必须替换的微信依赖

后端替换：

```text
wx-server-sdk              → 本地数据库适配层
cloud.database()           → localDb
cloud.getWXContext().OPENID → 当前登录用户 id
db.serverDate()            → new Date()
db.runTransaction()        → SQLite transaction
```

前端替换：

```text
wx.cloud.callFunction      → fetch('/api/business')
wx.cloud.uploadFile        → fetch('/api/files/signatures', FormData)
wx.cloud.getTempFileURL    → 后端文件访问接口
wx.getStorageSync          → localStorage 或内存缓存
wx.setStorageSync          → localStorage
wx.showToast               → Web Toast 组件
wx.navigateTo              → Web Router
Page()                     → Vue/React component
WXML/WXSS                  → HTML/CSS/component
```

身份替换：

```text
owner_whitelist.openid     → users.id
createdByOpenid            → createdByUserId
voidedByOpenid             → voidedByUserId
servicePersonOpenid        → servicePersonId
```

## 9. 数据库策略

因为没有历史数据需要迁移，第一版可以直接初始化新库。

建议仍然保留现有集合/表名语义：

```text
users
members
service_categories
services
recharge_tiers
card_types
records
balance_flows
card_flows
uploaded_files
audit_logs
```

金额规则保持不变：

```text
所有金额字段继续以 Cent 保存，单位为分。
```

例如：

```text
50000 = 500.00 元
```

第一版为了减少改动，可以使用 SQLite 文档表方式实现云数据库适配层：

```text
documents
- id
- collection
- data_json
- created_at
- updated_at
```

也可以对关键集合建独立表，但那会增加业务迁移工作量。当前目标是快速稳定切换框架，所以优先使用适配层。

## 10. 文件与签名

签名功能需要保留，但没有旧文件需要迁移。

目标流程：

```text
客户在手机网页 Canvas 签名
→ 前端生成图片 Blob
→ 上传到 /api/files/signatures
→ 后端保存到 /var/lib/queenangle/uploads/signatures
→ records 中保存 signatureFileId / signaturePath / signatureSignedAt
→ 记录详情中通过后端鉴权接口查看签名
```

上传文件不要直接裸露成公开静态文件。建议通过后端鉴权后输出：

```text
GET /api/files/:id
```

这样即使别人知道文件名，也不能绕过登录直接访问。

## 11. 服务器初始化清单

以下是服务器准备阶段清单，具体命令可按服务器系统调整。

### 11.1 基础系统

建议：

```bash
sudo apt update
sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Shanghai
```

2G 内存建议启用 2G swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

并写入 `/etc/fstab`，避免重启后失效。

### 11.2 创建运行用户和目录

```bash
sudo useradd --system --create-home --home-dir /opt/queenangle --shell /usr/sbin/nologin queenangle

sudo mkdir -p /opt/queenangle/app
sudo mkdir -p /opt/queenangle/web
sudo mkdir -p /var/lib/queenangle/db
sudo mkdir -p /var/lib/queenangle/uploads
sudo mkdir -p /var/backups/queenangle

sudo chown -R queenangle:queenangle /opt/queenangle
sudo chown -R queenangle:queenangle /var/lib/queenangle
sudo chown -R queenangle:queenangle /var/backups/queenangle
```

### 11.3 安装运行环境

需要：

```text
Node.js 20 LTS
Caddy
sqlite3 命令行工具
```

推荐 Caddy 是因为自动申请和续期 HTTPS 证书。

### 11.4 防火墙

只开放：

```text
22/tcp  SSH，最好限制来源 IP
80/tcp  HTTP，用于证书签发和跳转
443/tcp HTTPS
```

不要开放：

```text
3000/tcp Node 内部端口
SQLite 文件目录
上传文件目录
```

Node 服务只监听：

```text
127.0.0.1:3000
```

## 12. 生产环境变量

建议创建：

```text
/etc/queenangle.env
```

示例：

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
APP_ORIGIN=https://your-domain.com
SESSION_SECRET=replace-with-long-random-secret
DB_PATH=/var/lib/queenangle/db/queenangle.sqlite
UPLOAD_DIR=/var/lib/queenangle/uploads
COOKIE_SECURE=true
```

权限建议：

```bash
sudo chown root:queenangle /etc/queenangle.env
sudo chmod 640 /etc/queenangle.env
```

## 13. Caddy 配置目标

目标配置形态：

```caddyfile
your-domain.com {
  encode zstd gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:3000
  }

  handle {
    root * /opt/queenangle/web
    try_files {path} /index.html
    file_server
  }

  header {
    X-Content-Type-Options nosniff
    Referrer-Policy same-origin
    X-Frame-Options DENY
  }
}
```

上传文件不要直接通过 `file_server` 暴露，走 `/api/files/:id`。

## 14. systemd 服务目标

Node 后端建议由 systemd 托管：

```ini
[Unit]
Description=QueenAngle API
After=network.target

[Service]
Type=simple
User=queenangle
Group=queenangle
WorkingDirectory=/opt/queenangle/app
EnvironmentFile=/etc/queenangle.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

实际 `ExecStart` 路径以后按项目最终构建产物调整。

## 15. 备份方案

每天至少备份：

```text
SQLite 数据库
上传文件目录
环境变量可手动备份，不建议放入代码仓库
```

备份目录：

```text
/var/backups/queenangle
```

SQLite 不建议直接复制正在写入的数据库文件，应该使用 SQLite backup 机制：

```bash
sqlite3 /var/lib/queenangle/db/queenangle.sqlite ".backup '/var/backups/queenangle/queenangle-YYYYMMDD.sqlite'"
```

上传文件可以压缩：

```bash
tar -czf /var/backups/queenangle/uploads-YYYYMMDD.tar.gz /var/lib/queenangle/uploads
```

建议保留策略：

```text
本机保留最近 7 天
异地保留最近 30 天
```

异地备份可以用对象存储、另一台服务器、或手动下载。

## 16. 开发迁移步骤

推荐按以下顺序改项目：

### 第 1 步：建立 server 壳

- 新建 Node.js HTTP 服务。
- 增加 `/api/health`。
- 增加登录、登出、当前用户接口。
- 增加 Cookie 会话。
- 初始化两个账号。

### 第 2 步：实现 SQLite 云数据库适配层

适配现有业务代码需要的能力：

```text
db.collection(name).where(query).limit(n).get()
db.collection(name).orderBy(field, direction).limit(n).get()
db.collection(name).doc(id).get()
db.collection(name).doc(id).update({ data })
db.collection(name).add({ data })
db.collection(name).where(query).update({ data })
db.runTransaction(fn)
db.serverDate()
```

第一版只实现现有代码实际用到的查询能力，不做完整云数据库克隆。

### 第 3 步：迁移 business 云函数

把：

```text
cloudfunctions/business/index.js
```

迁到后端，例如：

```text
server/business/index.js
```

替换：

```text
wx-server-sdk
cloud.database()
cloud.getWXContext().OPENID
exports.main
```

保留：

```text
actions
createMemberCheckout
createGuestConsumption
createMemberRecharge
createCardPurchase
voidRecord
getHomeSummary
getBasicConfig
```

白名单相关逻辑可以下线或改成账号管理逻辑。

### 第 4 步：迁移前端调用层

把小程序的统一调用：

```text
wx.cloud.callFunction({ name: "business", data: { action, ...data } })
```

替换为 Web：

```text
fetch('/api/business', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action, ...data })
})
```

页面业务流程尽量照搬，不重新设计。

### 第 5 步：迁移手机页面

按现有页面顺序迁：

```text
登录
首页/今日流水
会员列表
会员详情
新增/编辑会员
散客消费
会员充值/购卡
会员结账
记录详情/作废
设置
签名页
```

手机优先，宽屏适配不是第一优先级。

### 第 6 步：签名与上传

- Web Canvas 实现签名。
- 上传签名图片到服务器。
- 业务记录保存签名文件 ID。
- 记录详情可预览签名。

### 第 7 步：部署与验收

- 构建前端静态文件到 `/opt/queenangle/web`。
- 部署后端到 `/opt/queenangle/app`。
- 启动 systemd 服务。
- 配置 Caddy。
- 确认 HTTPS 正常。

## 17. 上线验收清单

必须通过以下场景：

- 手机访问域名，HTTPS 正常。
- 老板账号可以登录。
- 老板娘账号可以登录。
- 未登录访问业务页面会跳转登录。
- 新建会员成功。
- 编辑会员成功。
- 新增服务项目成功。
- 新增充值档位成功。
- 新增次卡类型成功。
- 散客消费成功。
- 会员充值成功，余额正确增加。
- 会员购卡成功，次卡次数正确增加。
- 会员结账成功，余额、折扣、补差价、次卡扣减正确。
- 客户签名成功保存。
- 记录详情能看到签名。
- 作废记录后，会员余额和次卡次数正确恢复。
- 今日流水统计正确。
- 刷新页面后登录状态正常。
- 退出登录后不能访问业务 API。
- 备份脚本可以生成数据库备份和上传文件备份。
- 从备份恢复后数据可正常读取。

## 18. 风险点

### 18.1 业务逻辑风险

现有 `business` 逻辑较集中，迁移时要避免在重构中改变计算规则。尤其是：

- 余额抵扣
- 余额不足补差价
- 折扣失效
- 次卡扣减
- 作废后回放会员状态
- 今日流水统计

迁移时应该先保留结果一致，再考虑优化。

### 18.2 数据库适配风险

SQLite 适配层必须保证事务行为正确。涉及会员余额、次卡、流水的动作必须在事务内完成。

重点接口：

- `saveMember`
- `createMemberRecharge`
- `createMemberCheckout`
- `createCardPurchase`
- `voidRecord`
- `replaceTodayRecord`

### 18.3 安全风险

不要做：

- 明文保存密码
- token 放 localStorage
- 上传文件无鉴权公开访问
- Node 服务直接暴露公网端口
- SQLite 数据库文件放在 Web 静态目录
- 用 root 运行后端服务

### 18.4 服务器资源风险

2G 服务器可用，但要控制：

- 不上重型数据库
- 不跑多个 Node worker
- 日志做轮转
- 启用 swap
- 备份不要无限堆积

## 19. 第一版完成定义

第一版完成不是“功能更多”，而是：

```text
老板和老板娘可以用手机域名登录
完整完成日常收银和会员管理
现有核心业务规则不变
数据保存在自己服务器
不依赖微信生态
可备份、可恢复、可继续迭代
```

## 20. Docker 本地开发与服务器部署流程

当前确认的开发部署方式：

```text
本地电脑用 Docker 跑完整系统
→ 本地测试所有业务流程
→ 服务器也用 Docker 跑同一套镜像/配置
→ 正式数据、正式密钥只保存在服务器
```

这条路线的核心价值是减少环境差异。本地跑通的应用环境，服务器上也用同样方式运行。

### 20.1 本地开发阶段

本地项目中准备：

```text
Dockerfile
docker-compose.yml
.env.example
server/
web/
data/
uploads/
```

本地 `data/` 和 `uploads/` 只用于测试，必须加入 `.gitignore`，不要提交。

本地运行目标：

```text
Web 前端
Node 后端
SQLite 测试数据库
本地测试上传目录
```

本地访问：

```text
http://localhost:端口
```

本地测试通过以下核心流程后，再考虑部署：

```text
登录
新建会员
会员充值
会员结账
散客消费
购买/核销次卡
客户签名
作废记录
今日流水
退出登录
```

### 20.2 生产部署阶段

服务器上也使用 Docker 或 Docker Compose 运行。

生产服务器保存真实数据：

```text
/var/lib/queenangle/db
/var/lib/queenangle/uploads
```

容器内挂载为：

```text
/data/db
/data/uploads
```

生产环境变量放在服务器，不进入镜像：

```text
/etc/queenangle.env
```

生产部署可以先用：

```bash
docker compose up -d --build
```

后续更规范的方式是：

```text
本地或 CI 构建镜像
→ 推送到镜像仓库
→ 服务器拉取镜像
→ docker compose up -d
```

第一版为了简单，可以先在服务器上拉代码后构建，但正式数据目录和 `.env` 仍然必须独立。

### 20.3 代码、数据、密钥的边界

Docker 镜像里可以包含：

```text
应用代码
Node 运行环境
后端依赖
前端构建产物
启动脚本
```

Docker 镜像里不应该包含：

```text
SQLite 正式数据库
签名图片
上传文件
生产账号密码
SESSION_SECRET
正式域名配置密钥
```

本地和服务器应该保持：

```text
代码一致
容器环境一致
业务逻辑一致
```

但以下内容必须不同：

```text
本地：localhost、测试账号、测试数据库、测试上传文件
生产：正式域名 HTTPS、正式账号、正式数据库、正式上传文件
```

### 20.4 2G 服务器使用 Docker 的原则

2G 服务器可以使用 Docker，但要轻量使用。

建议容器数量：

```text
queenangle-app
caddy 或 nginx
```

不建议在 2G 服务器上运行：

```text
Kubernetes
GitLab
Jenkins
多个数据库容器
大型监控套件
无用面板服务
```

SQLite 不需要单独容器，它只是一个数据库文件，通过 volume 挂载给应用容器使用。

服务器建议开启：

```text
2G swap
Docker 日志大小限制
每日备份
```

Node 应用端口不要直接暴露公网，只由 Caddy/Nginx 反向代理。

## 21. AI 实施边界与人工确认事项

只要产品边界和技术路线确认，后续大部分代码工作可以由 AI 完成。

当前已确认技术路线：

```text
独立网站，不走微信
手机优先
老板和老板娘两个账号
Docker 本地开发和生产部署
SQLite
保留现有业务逻辑
保留客户签名
支付只是线下记录和二维码展示
```

AI 可以负责：

```text
搭建 server
搭建 web
编写 Dockerfile
编写 docker-compose.yml
编写 .env.example
实现 SQLite 适配层
迁移 business 逻辑
迁移手机页面
实现登录和会话
实现签名上传
实现备份脚本
编写部署文档
本地跑测试
修复迁移 bug
```

人工需要负责或确认：

```text
服务器重置和登录凭证
域名 DNS 解析
阿里云安全组开放 22/80/443
正式账号初始密码
生产 SESSION_SECRET
是否允许 AI 执行服务器命令
用手机真实验收业务流程
最终上线时间
```

原则上，AI 不应该替你保存正式密码或长期密钥。正式密码、服务器登录方式、生产密钥应由你自己保存。

开发中如果出现业务取舍，必须由你确认。例如：

```text
是否保留某个旧页面
某个支付文案是否继续叫微信/支付宝
签名是否强制必填
作废是否需要二次确认
是否允许编辑当天记录
```

其余工程实现问题由 AI 推进即可。
