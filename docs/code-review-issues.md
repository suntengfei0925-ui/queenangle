# 项目代码 Review 问题清单

日期：2026-05-06

## Review 范围

本次为静态代码 Review，覆盖范围包括：

- 小程序端：`miniprogram/`
- 云函数：`cloudfunctions/`
- 数据库与业务文档：`database/`、`docs/`
- 项目配置：`project.config.json`、`project.private.config.json`

已执行检查：

- 全量 JavaScript 语法检查：通过
- 全量 JSON 解析检查：通过

未执行检查：

- 未使用微信开发者工具进行真机或模拟器运行验证
- 未执行云开发真实环境联调
- 项目中未发现自动化测试用例，未进行测试套件回归

## P0 问题

| 问题点 | 问题出现的位置 | 可能出现的问题 | 风险等级 |
| --- | --- | --- | --- |
| 未发现 P0 级别问题 | 全项目 JS/JSON | 暂未发现语法级、配置解析级直接阻塞启动的问题 | P0 |

## P1 问题

| 问题点 | 问题出现的位置 | 可能出现的问题 | 风险等级 |
| --- | --- | --- | --- |
| 作废记录通过“重放当前规则”恢复会员状态，且只取最多 1000 条记录 | `cloudfunctions/business/index.js:2108`、`cloudfunctions/business/index.js:1927` | 历史规则变更、老记录、超过 1000 条会员记录时，作废后余额、折扣、次卡次数可能恢复错误 | P1 |
| 今日流水汇总只统计最近 100 条 | `cloudfunctions/business/index.js:2057`、`cloudfunctions/business/index.js:2067` | 当天超过 100 笔时，今日实收、消费金额、充值、购卡、有效笔数都会偏小 | P1 |
| 散客结账没有提交中锁 | `miniprogram/pages/guest-consumption/index.js:261`、`miniprogram/pages/guest-consumption/index.wxml:84` | 连续点击“保存记录”可能生成重复散客收银记录 | P1 |
| 散客实收金额清空后可直接提交为 0 | `miniprogram/pages/guest-consumption/index.js:186`、`miniprogram/pages/guest-consumption/index.js:274` | 老板清空实收框后未再改项目金额，可能把本应自动同步的实收记成 0 | P1 |
| 会员列表只取最近 200 个再搜索 | `cloudfunctions/business/index.js:785` | 会员超过 200 后，较老会员即使姓名或手机号匹配也搜不到，影响收银入口 | P1 |
| 最后老板保护不是事务 | `cloudfunctions/business/index.js:678`、`cloudfunctions/business/index.js:726` | 两个老板并发停用或取消老板权限时，可能把系统变成没有启用老板，后续无法管理白名单 | P1 |
| 当天记录替换不是原子操作 | `cloudfunctions/business/index.js:2142` | `replaceTodayRecord` 先作废旧记录，再创建新记录；新建失败会留下已作废旧单且没有替代单 | P1 |
| 签名凭证校验偏弱 | `cloudfunctions/business/index.js:105`、`cloudfunctions/business/index.js:1608`、`miniprogram/pages/member-consumption/index.js:714` | `signatureFileId`、签字时间都来自客户端，hash 也是 32 位非加密 hash；审计凭证存在被错链或伪造的风险 | P1 |

## P2 问题

| 问题点 | 问题出现的位置 | 可能出现的问题 | 风险等级 |
| --- | --- | --- | --- |
| 服务项目消费次数统计漏掉 `member_checkout` | `cloudfunctions/business/index.js:1091`、`cloudfunctions/business/index.js:1099` | 会员结账产生的服务项目不会参与使用次数排序，常用项目排序不准 | P2 |
| 金额解析把非法值转成 0 | `miniprogram/utils/format.js:6`、`cloudfunctions/business/index.js:50` | 异常输入或异常 API 调用可能绕过校验并落成 0 金额 | P2 |
| 配置启停接口用 `!!event.enabled` | `cloudfunctions/business/index.js:1080`、`cloudfunctions/business/index.js:1223`、`cloudfunctions/business/index.js:1453` | 如果传入字符串 `"false"` 会被当成 `true`，导致分类、服务、次卡停用失败 | P2 |
| 作废只改 `records`，流水集合没有作废状态 | `cloudfunctions/business/index.js:2128` | 未来如果按 `balance_flows` 或 `card_flows` 做报表，作废单流水仍会被误算 | P2 |
| 默认服务分类自动创建没有并发保护 | `cloudfunctions/business/index.js:985` | 首次多人同时进入时，可能重复创建“美甲/美睫”分类或“其他”项目 | P2 |
| 遗留服务分类页面/API 未注册入口 | `miniprogram/app.json:14`、`miniprogram/pages/settings/index.wxml:7` | 代码里还有 `service-categories` 页面和云函数动作，但页面未注册、设置页无入口，后续维护容易误判功能状态 | P2 |
| 云函数依赖使用 `latest` 且无锁文件 | `cloudfunctions/business/package.json:6`、`cloudfunctions/login/package.json:6` | 不同时间部署可能拿到不同 SDK 版本，引入不可复现问题 | P2 |
| `project.private.config.json` 被纳入版本管理 | `project.private.config.json:1`、`.gitignore:1` | 本地开发者配置容易造成团队配置污染；若以后加入敏感本地项会有泄露风险 | P2 |
| 缺少自动化测试 | 全项目 | 账务计算、作废重放、签名校验这些高风险逻辑没有回归保护 | P2 |

## 建议评估顺序

1. 优先评估并修复 P1 中的账务一致性问题：作废重放、今日流水上限、重复提交。
2. 其次处理权限与审计风险：最后老板保护、签名凭证校验。
3. 再处理 P2 中影响长期维护的问题：依赖锁定、遗留入口、自动化测试。

## 备注

本清单基于静态代码阅读和语法检查形成，不代表已经覆盖真实云开发运行环境中的所有异常。正式修复前建议先补充关键业务用例，至少覆盖：

- 会员充值后作废
- 会员结账后作废
- 次卡购买后作废
- 散客重复点击提交
- 当日超过 100 笔流水
- 会员超过 200 人搜索
- 余额不足补差价结账签名与提交
