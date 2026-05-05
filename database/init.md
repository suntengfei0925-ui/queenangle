# 云数据库初始化

## 1. 创建集合

在微信开发者工具的云开发控制台中创建以下集合：

```text
owner_whitelist
whitelist_applications
members
service_categories
services
recharge_tiers
card_types
records
balance_flows
card_flows
```

## 2. 集合权限

建议第一版全部设置为：

```text
仅云函数可读写
```

小程序端不直接读写数据库，全部通过云函数鉴权和执行业务规则。

## 3. 添加老板白名单

先运行小程序一次，进入无权限页后复制当前 openid。

在 `owner_whitelist` 集合添加一条记录：

```json
{
  "openid": "这里填写老板 openid",
  "name": "老板",
  "enabled": true,
  "isOwner": true,
  "remark": ""
}
```

## 4. 可选初始化数据

### 服务分类

集合：`service_categories`

```json
{
  "name": "美甲",
  "enabled": true,
  "createdAt": "由控制台填写或留空",
  "updatedAt": "由控制台填写或留空"
}
```

### 服务项目

集合：`services`

```json
{
  "categoryId": "这里填写服务分类 ID",
  "categoryName": "美甲",
  "name": "纯色",
  "isOther": false,
  "enabled": true,
  "remark": "",
  "createdAt": "由控制台填写或留空",
  "updatedAt": "由控制台填写或留空"
}
```

### 充值档位

集合：`recharge_tiers`

```json
{
  "amountCent": 50000,
  "discount": 9.5,
  "discountLabel": "9.5 折",
  "enabled": true
}
```

### 次卡类型

集合：`card_types`

```json
{
  "name": "手部护理 10 次卡",
  "totalTimes": 10,
  "priceCent": 68000,
  "enabled": true,
  "remark": ""
}
```

## 5. 重要说明

- 金额字段以分保存，例如 `50000` 表示 `500.00` 元。
- 会员余额、折扣、次卡次数只能由云函数修改。
- 作废记录会保留原始记录，并按记录快照回滚会员余额、折扣或次卡次数。

