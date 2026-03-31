# skill-action

[English](./README.md)

一个以 RFC 为核心入口的 Action/Skill 运行时系统。

## 这是什么

`skill-action` 是一个 RFC-driven 的 Action/Skill runtime system。

它把 Action 和 Skill package 看作一组显式契约，强调：

- deterministic 的执行语义
- schema-first 的输入输出边界
- package-local 的组合规则
- protocol-defined 的解析、校验与执行行为

目标是把原本偏 agent-like 的能力，收敛成可以稳定执行、稳定验证、稳定组合的运行时单元，而不是停留在松散 prompt 或某个框架私有约定里。

## 为什么存在

这个项目存在的原因，是把 agent-like 能力收敛成一种：

- deterministic：执行步骤、binding、condition、returns 都是显式定义的
- schema-first：每个 Action 都有可验证、可互操作的契约
- composable：primitive Action 和 composite Action 可以组成局部 Skill 图
- inspectable：解析、校验、执行都是协议层能力，而不是黑盒框架行为

换句话说，它试图把“像 agent 一样工作”的能力，重新表达成“可装载、可组合、可预测”的 package/runtime 模型。

## 仓库里有什么

### `rfc/`

这是仓库的规范层。

- [`rfc/Action Specification.md`](./rfc/Action%20Specification.md)：定义 Action 模型、binding、condition、composite 执行、`returns`
- [`rfc/Action Runtime Protocol.md`](./rfc/Action%20Runtime%20Protocol.md)：定义 transport、请求/响应结构、错误模型、执行语义
- [`rfc/Skill Package Specification.md`](./rfc/Skill%20Package%20Specification.md)：定义 package 布局、`skill.json`、`actions/actions.json`、入口 action 和暴露规则

### `runtime/`

TypeScript 运行时实现，发布包名为 [`@rien7/skill-action-runtime`](./runtime/README.md)。

它实现了四个核心协议能力：

- `resolveAction`
- `validateActionInput`
- `executeAction`
- `executeSkill`

### `runtime-cli/`

命令行运行时，发布包名为 [`@rien7/skill-action-runtime-cli`](./runtime-cli/README.md)。

它把 RFC 里的协议模型暴露成 CLI 入口，用于：

- discovery
- validation
- resolution
- execution

### `skills/`

这里放的是基于同一套 RFC package 模型构建的 Skill 包和作者工具。

当前仓库里的例子主要围绕 action-based skill 的创建与运行：

- `skills/action-creator`
- `skills/action-runner`
- `skills/action-skill-creator`

## 怎么开始

### 1. 先读规范摘要

建议按这个顺序读：

1. [Action Specification](./rfc/Action%20Specification.md)
2. [Action Runtime Protocol](./rfc/Action%20Runtime%20Protocol.md)
3. [Skill Package Specification](./rfc/Skill%20Package%20Specification.md)

如果你只想快速抓住重点，可以优先看：

- Action RFC：action kind、binding、condition、composite `returns`
- Protocol RFC：request/response 模型、error model、deterministic execution
- Skill Package RFC：package layout、`entry_action`、`exposed_actions`、local resolution

### 2. 安装 runtime 和 CLI

安装已发布包：

```bash
pnpm add @rien7/skill-action-runtime
pnpm add -g @rien7/skill-action-runtime-cli
```

如果你是在这个仓库里本地开发，分别在子目录安装和构建：

```bash
cd runtime
pnpm install
pnpm check
```

```bash
cd runtime-cli
pnpm install
pnpm check
```

### 3. 跑一个 sample skill package

仓库里自带一个 sample package，路径在 [`runtime-cli/test/fixtures/sample-skill`](./runtime-cli/test/fixtures/sample-skill)。

先校验：

```bash
cd runtime-cli
skill-action-runtime validate-skill-package --skill-package ./test/fixtures/sample-skill
```

再执行它的公开入口：

```bash
cd runtime-cli
echo '{"skill_id":"sample.skill","input":{"value":4}}' \
  | skill-action-runtime execute-skill \
      --skill-package ./test/fixtures/sample-skill \
      --handler-module ./test/fixtures/handlers.mjs
```

这个 sample 展示了什么：

- `sample.skill` 暴露了 `workflow.increment` 作为 entry action
- `workflow.increment` 是一个 composite Action
- 它内部调用了 primitive Action `math.add-one`
- primitive 的实际执行由 handler module 提供

## 按角色阅读

- 只想理解模型：先看 `rfc/`
- 想嵌入运行时：先读 `rfc/`，再看 [`runtime/README.md`](./runtime/README.md)
- 想从命令行跑：先读 `rfc/Action Runtime Protocol.md`，再看 [`runtime-cli/README.md`](./runtime-cli/README.md)
- 想写 Skill package：先读 Skill Package RFC，再看 `skills/`

## 仓库原则

RFC 才是这个项目的产品表面。

runtime、CLI 和 skill packages 的作用，是实现并验证这层表面，而不是替代它。
