# skill-action

[English](./README.md)

## 你可以用它做什么

用 `skill-action`，你可以：

- 把一个可复用能力写成一个小 package
- 在执行前先校验输入
- 运行某个指定 Action，或者运行整个 Skill 的公开入口 Action
- 把小 Action 组合成更大的 workflow，并且清楚写出步骤之间怎么传值

核心思路很简单：不要把行为藏在 prompt 或框架内部，而是把它写进运行时可以直接校验和执行的文件里。
这个仓库定义了这套文件格式，并提供了对应的 runtime。

## 快速开始

1. 安装 CLI 运行时：

```bash
npm i -g @rien7/skill-action-runtime-cli
```

2. 安装这个仓库提供的 skills：

```bash
npx skills add rien7/skill-action
```

3. 在 agent 环境中使用 `action-skill-creator` 创建新的 skill package。

## 最小 Action/Skill 例子

在这个仓库里，一个 skill 是一个目录，里面包含 `skill.json`，以及一个或多个 `actions/*/action.json` 文件。

最小目录结构如下：

```txt
sample-skill/
  skill.json
  actions/
    workflow-increment/
      action.json
    math-add-one/
      action.json
```

最小可工作形态如下：

```json
{
  "skill_id": "sample.skill",
  "title": "Sample Skill",
  "entry_action": "workflow.increment"
}
```

```json
{
  "action_id": "workflow.increment",
  "kind": "composite",
  "idempotent": true,
  "steps": [
    {
      "id": "addOne",
      "action": "math.add-one",
      "with": {
        "value": "$input.value"
      }
    }
  ],
  "returns": {
    "value": "$steps.addOne.output.value"
  }
}
```

```json
{
  "action_id": "math.add-one",
  "kind": "primitive",
  "idempotent": true
}
```

这已经足以表达一个小型 skill：它的公开 workflow 会把输入数字加一后返回。

## 与 agent runtime 的对比

`skill-action` 更准确地说是执行层，而不是完整的 agent runtime。

| `skill-action`                       | agent runtime                               |
| ------------------------------------ | ------------------------------------------- |
| 运行命名好的 action 和 skill package | 在运行时决定下一步做什么                    |
| 依赖声明好的输入、输出和步骤间数据流 | 往往依赖 planner、prompt 或隐藏的运行时状态 |
| 提供可预测、可复用的执行单元         | 提供开放式编排能力                          |
| 很适合作为 agent 的底层能力          | 往往自己就是完整的 agent 系统               |

你当然可以在它上面构建 agents，但这个项目的目标更明确：让行为更容易校验、执行和复用。

## 怎么开始

### 1. 如果你想了解完整模型，再读规范

建议按这个顺序读：

1. [Action Specification](./rfc/Action%20Specification.md)
2. [Action Runtime Protocol](./rfc/Action%20Runtime%20Protocol.md)
3. [Skill Package Specification](./rfc/Skill%20Package%20Specification.md)

如果你只需要主要部分，可以优先看：

- Action RFC：action kind、binding、condition、composite `returns`
- Protocol RFC：request/response 结构、错误、可重复执行
- Skill Package RFC：目录结构、`entry_action`、暴露的 action、本地查找规则

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

### 3. 跑仓库里自带的 sample Skill package

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

### 4. 看这个最小完整示例

如果你想看一条基于这个仓库真实示例的完整 end-to-end workflow，可以直接读：

- [`example/01-create-the-skill.md`](./example/01-create-the-skill.md)
- [`example/02-use-the-skill.md`](./example/02-use-the-skill.md)

这两篇 walkthrough 对应的 package 在 [`example/skills/capture-link-to-apple-notes`](./example/skills/capture-link-to-apple-notes)。

下面这些命令都假设你当前在仓库根目录：

```bash
skill-action-runtime validate-skill-package \
  --skill-package ./example/skills/capture-link-to-apple-notes \
  --output json
```

```bash
skill-action-runtime execute-skill \
  --skill-package ./example/skills/capture-link-to-apple-notes \
  --skill-id capture.link_to_apple_notes \
  --handler-module ./example/skills/capture-link-to-apple-notes/handlers.mjs \
  --trace-level none \
  --input-json '{"url":"https://www.example.com","dry_run":true}' \
  --output json
```

### 5. 执行流程与安全重跑

```mermaid
flowchart LR
  U["用户请求"] --> S["execute-skill\nskill_id: capture.link_to_apple_notes\nentry_action: workflow.capture-link"]
  S --> W["workflow.capture-link\ncomposite\nidempotent: false"]
  W --> F["web.fetch-content\nprimitive\nidempotent: true"]
  F --> N["notes.create-note\nprimitive\nidempotent: false"]
  N --> O["在 Apple Notes 中创建 note"]
  W --> R["结构化输出\nurl, fetch_url, note_title,\nnote_created, note_id, content_preview"]
  F -. "可以安全重试或重复验证" .-> F
  N -. "不要盲目重试\n否则可能产生重复 note" .-> N
```

关键点：

- `web.fetch-content` 可以安全重跑，因为重复抓取不会创建重复的外部记录
- `notes.create-note` 不适合盲目重跑，因为重复执行可能创建多个 note
- `workflow.capture-link` 也不适合盲目重跑，因为它内部包含了创建 note 的步骤

这也是为什么这个 package 还额外支持输入级别的 `dry_run`：

- 可以安全验证整个 workflow
- 可以真实跑过 fetch 这一步，但不创建 note
- 不需要把每次验证都当成一次带副作用的写操作

## 仓库里有什么

### `rfc/`

这里写的是 action、skill 和执行方式的规范。

- [`rfc/Action Specification.md`](./rfc/Action%20Specification.md)：action 模型，以及 composite action 的执行方式
- [`rfc/Action Runtime Protocol.md`](./rfc/Action%20Runtime%20Protocol.md)：请求、响应和错误的结构
- [`rfc/Skill Package Specification.md`](./rfc/Skill%20Package%20Specification.md)：skill package 的目录结构与公开入口

### `runtime/`

TypeScript 运行时实现，发布包名为 [`@rien7/skill-action-runtime`](./runtime/README.md)。

它提供 4 个核心能力：

- `resolveAction`
- `validateActionInput`
- `executeAction`
- `executeSkill`

### `runtime-cli/`

命令行运行时，发布包名为 [`@rien7/skill-action-runtime-cli`](./runtime-cli/README.md)。

它通过命令行提供同一套能力，用于：

- discovery
- validation
- resolution
- execution

### `skills/`

这里放的是可复用的 skill 包，以及用于创建它们的辅助工具。

当前仓库里的例子主要围绕 skill 的创建与运行：

- `skills/action-creator`
- `skills/action-runner`
- `skills/action-skill-creator`

### `example/`

这里放的是一套可以公开阅读的完整示例，展示：

- 从自然语言需求出发
- 生成一个可运行的 skill
- 通过 runtime CLI 做验证
- 在后续请求里使用这个生成出来的 skill

建议按这两个文件阅读：

- [`example/01-create-the-skill.md`](./example/01-create-the-skill.md)
- [`example/02-use-the-skill.md`](./example/02-use-the-skill.md)

### 按角色阅读

- 如果你只想快速跑起来：先看 `快速开始`
- 如果你想看完整示例：先看 `example/`
- 如果你想看实现细节：读 `runtime/` 和 `runtime-cli/`
- 如果你想写 skill：先看 `skills/`，再按需读 RFC
