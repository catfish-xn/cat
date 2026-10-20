# D14 公开单位标记

公共入口：`src/simulation/match.ts` 和 `src/server-entry/index.ts`。

签名：`d14PublicUnitMark(state: MatchState, unitId: string): { effectiveStarLevel: 4 } | null`。

仅当当前 `state.preparation.units` 中存在该单位，且 `state.d14.unitId` 匹配、阶段为 `promoted` 时返回四星标记。无 D14、其他单位、其他阶段或单位不存在均返回 `null`；无失败原因枚举。纯读取，不改变状态、事件、资源或 RNG。

侦察调用方只读取此返回值；其中没有 `sellGold`、`poolCopies`、托管资源或选择历史。拥有者私有投影继续返回原字段并保持原顺序，双方复用同一晋升判定。
