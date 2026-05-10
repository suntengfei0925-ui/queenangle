# QueenAngle 阿里云 Docker 生产部署清单

本文档按你的当前部署方式编写：阿里云服务器已经有 Docker 环境，Docker Engine 版本为 `26.1.3`。这里不再假设服务器系统是 Ubuntu，也不写系统安装 Docker 的步骤。

目标边界：

```text
应用代码 -> 打进 Docker 镜像
正式数据库 -> 阿里云服务器宿主机目录
签名/上传文件 -> 阿里云服务器宿主机目录
正式账号/密码/密钥 -> /etc/queenangle.env
HTTPS 入口 -> Caddy 容器
```

不要把正式 SQLite、上传文件、`.env` 或备份文件打进镜像。

## 1. 阿里云准备

在阿里云控制台确认：

- 域名已解析到这台服务器公网 IP。
- 安全组入方向放行 `80`、`443`。
- SSH 管理端口只对你的常用 IP 放行。
- 服务器上 Docker Engine 是 `26.1.3`。

登录服务器后检查：

```bash
docker version
docker compose version
```

如果 `docker compose version` 不存在，说明只有 Docker Engine，没有 Compose 插件，需要先补 Compose 插件；本项目生产部署使用 `docker compose` 命令。

## 2. 服务器目录

在阿里云服务器宿主机创建目录：

```bash
mkdir -p /opt/queenangle/app
mkdir -p /var/lib/queenangle/db
mkdir -p /var/lib/queenangle/uploads
mkdir -p /var/backups/queenangle
```

目录含义：

```text
/opt/queenangle/app            应用代码
/var/lib/queenangle/db         SQLite 正式数据库
/var/lib/queenangle/uploads    签名和上传文件
/var/backups/queenangle        备份文件
/etc/queenangle.env            生产环境变量
```

## 3. 上传代码

把当前项目代码放到服务器：

```bash
cd /opt/queenangle/app
```

可以用 `git clone`、`git pull`、SFTP 或压缩包上传。确保服务器目录里能看到：

```text
Dockerfile
docker-compose.prod.yml
deploy/Caddyfile
deploy/queenangle.env.example
server/
web/
scripts/
package.json
package-lock.json
```

## 4. 生产环境变量

复制模板：

```bash
cp deploy/queenangle.env.example /etc/queenangle.env
chmod 600 /etc/queenangle.env
```

编辑：

```bash
vi /etc/queenangle.env
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

生成 `SESSION_SECRET`：

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

如阿里云拉取默认 Node 镜像失败，可在 `/etc/queenangle.env` 里临时启用：

```text
NODE_IMAGE=node:22-bookworm
```

## 5. 启动容器

在服务器执行：

```bash
cd /opt/queenangle/app
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml up -d --build
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml ps
```

生产 compose 会启动两个容器：

```text
queenangle-app      Node 应用，内部端口 3000
queenangle-caddy    HTTPS 入口，监听 80/443
```

数据挂载：

```text
/var/lib/queenangle/db      -> /data/db
/var/lib/queenangle/uploads -> /data/uploads
```

这两个宿主机目录就是正式数据位置。

## 6. 健康检查

服务器本机检查应用：

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

浏览器访问：

```text
https://你的正式域名
```

如果 HTTPS 不通，优先检查：

- 域名 DNS 是否指向阿里云服务器公网 IP。
- 阿里云安全组是否放行 `80` 和 `443`。
- 服务器内是否有其他程序占用 `80` 或 `443`。
- `docker logs --tail 120 queenangle-caddy` 是否有证书申请错误。

## 7. 导入本地数据

如果要把当前本地 SQLite 带到服务器：

1. 本地先停止写入或确认没有操作。
2. 上传本地文件：

```text
D:\queenangle\data\queenangle.sqlite
```

到服务器：

```text
/var/lib/queenangle/db/queenangle.sqlite
```

3. 上传签名文件目录：

```text
D:\queenangle\uploads
```

到服务器：

```text
/var/lib/queenangle/uploads
```

4. 重启应用：

```bash
cd /opt/queenangle/app
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml restart queenangle-app
```

## 8. 备份

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

默认输出：

```text
/var/backups/queenangle/queenangle-YYYYmmdd-HHMMSS.tar.gz
```

建议每天凌晨自动备份：

```bash
crontab -e
```

加入：

```cron
20 3 * * * cd /opt/queenangle/app && /bin/sh scripts/backup.sh >> /var/backups/queenangle/backup.log 2>&1
```

默认保留 30 天，可调整：

```bash
RETENTION_DAYS=60 sh scripts/backup.sh
```

## 9. 恢复

恢复前会先停应用容器，并尝试保存一份当前数据快照：

```bash
cd /opt/queenangle/app
sh scripts/restore.sh /var/backups/queenangle/queenangle-YYYYmmdd-HHMMSS.tar.gz
```

恢复后检查：

```bash
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

## 10. 更新应用

更新前先备份：

```bash
cd /opt/queenangle/app
sh scripts/backup.sh
```

如果用 git 管理代码：

```bash
git pull
docker compose --env-file /etc/queenangle.env -f docker-compose.prod.yml up -d --build
docker logs --tail 120 queenangle-app
```

正式数据目录和 `/etc/queenangle.env` 不进入镜像，也不进入 git。

## 11. 上线验收

用手机浏览器访问正式域名，逐项确认：

- 未登录时不能进入业务页面。
- 老板账号和老板娘账号能登录。
- 服务分类、服务项目、充值档位、次卡类型能正常显示。
- 新建会员后能搜索到。
- 会员充值后余额变化正确。
- 会员购卡后次卡次数变化正确。
- 散客消费能进入今日流水。
- 会员结账能签字，记录详情能看到签名。
- 作废会员结账后余额或次卡回滚正确。
- 今日流水金额和有效笔数正确。
- 退出登录后刷新页面仍保持未登录。
- 备份脚本能生成 `tar.gz`，并且 `tar -tzf` 可正常列出内容。

## 12. 注意事项

- 不要把 `/etc/queenangle.env`、`/var/lib/queenangle`、`/var/backups/queenangle` 提交到 git。
- 不要使用本地测试账号密码上线。
- `SESSION_SECRET` 上线后不要随意修改，修改后现有登录会话会失效。
- 上传文件必须通过 `/api/files/:id` 鉴权访问，不要把 uploads 目录暴露成公开静态目录。
- 如果服务器没有域名和 HTTPS，生产 Cookie 的 `COOKIE_SECURE=true` 会导致浏览器无法在 HTTP 下登录；正式上线建议必须走 HTTPS。
