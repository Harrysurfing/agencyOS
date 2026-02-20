# GM Editor — Triangle Agency 特工状态编辑

供 **GM** 使用的本地编辑工具，用于维护 AgencyOS 所需的数据：机构状态、特工信息、申领物、任务报告与收件箱邮件。数据写入 **上一级目录** 的 `data/`（即 `agencyOS/data/`），与看板共用同一套 JSON 文件。

**要求**：Node.js（仅用内置模块，无需 `npm install`）。

## 运行

在仓库中进入 GM Editor 目录并启动服务器：

```bash
cd agencyOS/gm-editor
node server.js
```

浏览器访问 **http://localhost:3001**。

修改 `server.js` 后需重启服务器（Ctrl+C 再重新执行 `node server.js`）才能生效。

**保存后同步**：在 GM Editor 中点击「保存」会写入本地 `data/` 下的 JSON 文件。若看板通过 Git 仓库部署（如 GitHub Pages），需在本地执行 `git add`、`git commit`、`git push` 将变更推送到远程仓库，玩家或部署端才能看到更新。

## 功能

- **机构状态**：混沌值、散逸端
- **机构动态**：添加/删除新闻（日期自动为当天）
- **收件箱邮件**：编辑一封「新邮件」（标题+内容），或清除；玩家在 AgencyOS 打开时会看到「新邮件提醒」
- **特工选择与编辑**：
  - 嘉奖、申诫、察看期、MVP
  - 资质保证 (QA)：每项可设「剩余」与「最大」
  - 参考信息（只读、可折叠）：异常能力、现实触发器/过载解除、职能首要指令/许可行为、申领物
  - **异常能力**：可添加自定义能力，勾选「可练习」则带「已练习」与「为人所知」轨道；可删除能力
  - **关系**：添加/编辑/删除
  - **申领物**：从目录添加、删除
- **新建任务报告**：写入 `data/mission.json`
- **任务笔记**：从 `agencyOS/missionNotes/` 读取 Markdown（该目录已在 `.gitignore`，仅本地使用）

## 数据路径

| 用途         | 文件路径（相对于 agencyOS） |
|--------------|-----------------------------|
| 机构与特工   | `data/statuses.json`        |
| ARC 参考     | `data/arc-reference.json`   |
| 任务报告     | `data/mission.json`         |
| 申领物目录   | `data/items.json`           |
| 收件箱邮件   | `data/inMail.json`          |
| 任务笔记     | `missionNotes/`（仅本地，gitignore） |

GM Editor 进程的「数据目录」为 `gm-editor` 的上一级下的 `data/`，即仓库中的 `agencyOS/data/`。

## 参见

- 看板说明与部署：[../README.md](../README.md)（AgencyOS 根目录）
