结论：**不通过，1 项 P2 must-fix。**

- **P2：选秀来源单位变形后，合法存档被拒绝。** [augment-pool-batch5-r6.ts:44](src/simulation/augment-pool-batch5-r6.ts:44) 保留实例 ID 并改变英雄定义，但 [carousel.ts:515](src/simulation/carousel.ts:515) 仍要求当前定义等于原始选秀收据。已用正式房间复现：seed=8、s3，2-4 取得婕拉，2-6 经潘朵拉变为麦迪后移出变形格；3-4 调用 `restoreCarouselSeat`，即使提供独立服务器权威句柄，仍报 `receipt-mismatch`。两卡共用此变形逻辑。建议恢复时依据已认证的变形与合星记录核对当前身份，保留原始领取收据，并补两卡的选秀来源单位恢复测试。

可选建议：补充两卡变形后的真实 WebSocket 重连测试。

验证：9 个相关测试文件、153 项通过；追加复现用例失败。未修改受跟踪文件、未提交，工作区干净。