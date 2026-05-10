# QueenAngle 生产部署清单

本文档用于第一版独立 Web 上线。目标是：代码进镜像，正式数据、上传文件、密钥和账号留在服务器。

## 1. 服务器准备

推荐 Ubuntu 22.04 LTS 或 24.04 LTS，安装 Docker 和 Docker Compose Plugin。

服务器目录：

```bash
sudo mkdir -p /opt/queenangle/app
sudo mkdir -p /var/lib/queenangle/db
sudo mkdir -p /var/lib/queenangle/uploads
sudo mkdir -p /var/backups/queenangle
```

如果使用独立系统用户运行部署命令，可把这些目录授权给该用户；不要把数据库目录放进 Web 静态目录。

## 2. 环境变量

复制模板：

```bash
sudo cp deploy/queenangle.env.example /etc/queenangle.env
sudo chmod 600 /etc/queenangle.env
sudo nano /etc/queenangle.env
```

必须修改：

```text
DOMAIN=你的正式域名
APP_ORIGIN=https://你的正式域名
SESSION_SECRET=至少 32 字符的随机密钥
OWNER_USERNAME=老板账号
OWNER_PASSWORD=老板强密码
OWNER_NAME=老板显示名
PARTNER_USERNAME=老板娘账号
PARTNER_PASSWORD=老板娘强密码
PARTNER_NAME=老板娘显示名
```

生成密钥：

```bash
openssl rand -base64 48
```

生产环境保持：

```text
NODE_ENV=production
COOKIE_SECURE=true
DB_PATH=/data/db/queenangle.sqlite
UPLOAD_DIR=/data/uploads
```

## 3. 启动

把仓库代码放到 `/opt/queenangle/app` 后执行：

```bash
cd /opt/queenangle/app
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml up -d --build
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml ps
```

Caddy 会用 `deploy/Caddyfile` 自动申请 HTTPS 证书。服务器防火墙需要放行 80 和 443。

如果需要在本地临时验证生产 compose 文件，可以用模板 env 文件：

```bash
QUEENANGLE_ENV_FILE=deploy/queenangle.env.example docker compose --env-file deploy/queenangle.env.example -f docker-compose.prod.yml config
```

本地只看应用健康：

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

正式访问：

```text
https://你的正式域名
```

## 4. 备份

手动备份：

```bash
cd /opt/queenangle/app
sh scripts/backup.sh
```

备份内容：

```text
/var/lib/queenangle/db
/var/lib/queenangle/uploads
```

默认输出到：

```text
/var/backups/queenangle/queenangle-YYYYmmdd-HHMMSS.tar.gz
```

建议每天凌晨自动备份：

```bash
sudo crontab -e
```

加入：

```cron
20 3 * * * cd /opt/queenangle/app && /bin/sh scripts/backup.sh >> /var/backups/queenangle/backup.log 2>&1
```

默认保留 30 天，可通过 `RETENTION_DAYS` 调整：

```bash
RETENTION_DAYS=60 sh scripts/backup.sh
```

## 5. 恢复

恢复会先停应用容器，并在恢复前尝试保存一份当前数据快照。

```bash
cd /opt/queenangle/app
sh scripts/restore.sh /var/backups/queenangle/queenangle-YYYYmmdd-HHMMSS.tar.gz
```

恢复后检查：

```bash
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

## 6. 更新应用

第一版可以先在服务器拉取新代码后重建：

```bash
cd /opt/queenangle/app
sh scripts/backup.sh
git pull
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml up -d --build
docker logs --tail 120 queenangle-app
```

正式数据目录和 `/etc/queenangle.env` 不进入镜像，也不进 git。

## 7. 上线验收

用手机浏览器访问正式域名，逐项确认：

- 未登录时不能进入业务页。
- 老板账号和老板娘账号能登录。
- 新增服务分类、服务项目、充值档位、次卡类型可用。
- 新建会员后能搜索到。
- 会员充值后余额变化正确。
- 会员购卡后次卡次数变化正确。
- 散客消费能进入今日流水。
- 会员结账能签字，记录详情能看到签名。
- 作废会员结账后余额或次卡回滚正确。
- 今日流水金额和有效笔数正确。
- 退出登录后刷新页面仍保持未登录。
- 备份脚本能生成 tar.gz，并且 `tar -tzf` 可正常列出内容。

## 8. 生产注意事项

- 不要把 `/etc/queenangle.env`、`/var/lib/queenangle`、`/var/backups/queenangle` 提交到 git。
- 不要用本地测试账号密码上线。
- `SESSION_SECRET` 上线后不要随意改，改了会让现有登录会话失效。
- 上传文件必须通过 `/api/files/:id` 鉴权访问，不要把 uploads 目录暴露成公开静态目录。
- 如果域名证书申请失败，先检查 DNS 是否解析到服务器公网 IP，以及 80/443 是否放行。
