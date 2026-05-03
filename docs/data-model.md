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
balanceCent
currentDiscount
currentDiscountLabel
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
name
priceCent
enabled
remark
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
createdByOpenid
createdAt
updatedAt
voidReason
voidedAt
```

`type` 支持：

```text
guest_consumption
member_consumption
member_recharge
card_purchase
card_use
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

