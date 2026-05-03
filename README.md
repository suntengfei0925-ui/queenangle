# 美甲店记账会员小程序

这是一个按 PRD v1.0 搭建的微信小程序 + 云开发项目骨架，面向美甲店老板本人使用。

## 目录

```text
miniprogram/          小程序端代码
cloudfunctions/       云函数
database/             云数据库初始化说明
docs/                 产品与数据设计文档
```

## 快速开始

1. 用微信开发者工具导入本目录。
2. 开通云开发并创建环境。
3. 如需固定云环境，在 `miniprogram/app.js` 中填写 `cloudEnv`；不填时使用开发者工具当前云环境。
4. 上传并部署 `cloudfunctions/login` 和 `cloudfunctions/business`。
5. 按 `database/init.md` 创建集合并添加老板 openid 白名单。
6. 在微信开发者工具中编译运行。

## 核心集合

```text
owner_whitelist
members
services
recharge_tiers
card_types
records
balance_flows
card_flows
```

金额统一以 `Cent` 字段保存，单位为分，避免小数精度问题。

## 第一版范围

已包含：

- openid 白名单校验
- 会员新增、编辑、搜索
- 服务项目、充值档位、次卡类型维护
- 散客消费、会员充值、会员消费、次卡购买、次卡核销
- 会员余额、折扣、次卡次数自动变更
- 今日流水、会员详情、单笔记录详情
- 历史作废与会员状态重算逻辑

未包含：

- 微信支付
- Web 后台
- 多用户权限
- Excel 导出
- 复杂经营分析
