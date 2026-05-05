# 数据模型

## owner_whitelist

```text
openid
name
enabled
createdAt
```

## members

```text
name
phone
remark
birthdayMonth
birthdayDay
balanceCent
currentDiscount
currentDiscountLabel
memberSource
offlineBook
offlinePage
importRemark
importedAt
importedByOpenid
cardBalances[]
createdAt
updatedAt
```

`cardBalances` 示例：

```json
[
  {
    "cardTypeId": "card_type_id",
    "cardName": "手部护理 10 次卡",
    "remainingTimes": 8
  }
]
```

## services

```text
categoryId
categoryName
name
isOther
enabled
remark
createdAt
updatedAt
```

## service_categories

```text
name
enabled
createdAt
updatedAt
```

## recharge_tiers

```text
amountCent
discount
discountLabel
enabled
createdAt
updatedAt
```

## card_types

```text
name
totalTimes
priceCent
enabled
remark
createdAt
updatedAt
```

## records

所有业务动作统一进入 `records` 集合。

通用字段：

```text
type
status
memberId
memberName
actualReceivedCent
consumptionAmountCent
balancePayCent
paymentMethod
remark
occurredAt
businessDate
memberBefore
memberAfter
serviceItems[]
createdByOpenid
createdAt
updatedAt
voidReason
voidedAt
```

`serviceItems` 为消费记录的项目快照，只用于 `guest_consumption` 和 `member_consumption`：

```json
[
  {
    "categoryId": "category_id",
    "categoryName": "美甲",
    "serviceId": "service_id",
    "serviceName": "纯色",
    "originalAmountCent": 12800
  }
]
```

`type` 支持：

```text
guest_consumption
member_consumption
member_checkout
member_recharge
member_initial_balance
card_purchase
```

`importRemark` 为系统自动生成的补录备注，不由页面手动输入。

`member_initial_balance` 用于老会员新建补录，不计入充值收入。核心字段：

```text
amountCent
actualReceivedCent = 0
paymentMethod = 空
discount
discountLabel
offlineBook
offlinePage
remark
```

`member_checkout` 用于会员结账，可同时包含普通项目和次卡。核心字段：

```text
serviceItems[]
cardItems[]
originalAmountCent
consumptionAmountCent
balancePayCent
extraPayCent
actualReceivedCent
paymentMethod
extraPaymentMethod
discountApplied
discountLabelApplied
```

`status` 支持：

```text
active
void
```

## balance_flows

```text
memberId
memberName
type
sourceRecordId
amountCent
balanceAfterCent
remark
createdAt
```

`type` 支持：

```text
initial_balance
recharge
consume
```

## card_flows

```text
memberId
memberName
type
sourceRecordId
cardTypeId
cardName
deltaTimes
remainingTimes
remark
createdAt
```

