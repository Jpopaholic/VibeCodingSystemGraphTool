package com.vibegraph.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ui.Messages
import java.awt.datatransfer.StringSelection
import java.util.Locale

class BootstrapAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        val goal = Messages.showInputDialog(
            project,
            "請描述您的系統願景 / Describe your system vision",
            "VibeGraph Bootstrap",
            Messages.getQuestionIcon(),
            "例如：做一個多人連線井字遊戲",
            null
        ) ?: return

        if (goal.isBlank()) return

        val isZh = Locale.getDefault().language.startsWith("zh")

        val prompt = if (isZh) {
            """請作為軟體架構規劃專家，分析我接下來要建造的系統想法。
我希望在專案根目錄下建立一個 `system-graph.json` 檔案。這個檔案是我們協同開發的唯一契約。
請為我規劃以下三個部分，並輸出為純 JSON 格式（不要包含任何 markdown 標記或 ```json 區塊，直接輸出 JSON 內容）：

1. "glossary": { "名詞": "定義與資料結構模型說明" }，提取系統的核心業務實體名詞。
2. "globalConstraints": [ "全域系統約束條件（如技術棧、排版風格）" ]。
3. "nodes": [
     {
       "id": "唯一的英文識別碼（例如 auth-helper）",
       "name": "中文組件名稱",
       "produce": "以主動動詞說明它產出什麼成果（使用繁體中文，例如「在本地儲存會話」）",
       "vibeNotes": "該組件的補充說明備忘",
       "dependencies": [ "依賴的其他 node id 陣列" ],
       "synthesis": {
         "filePath": "建議的實體檔案存放路徑（例如 src/utils/auth.js）",
         "status": "todo",
         "intentSignal": "精煉後的乾淨核心實作目的（使用繁體中文）",
         "extractedConstraints": [ "從說明中提煉出的具體技術規範（如不能用第三方庫）" ]
       },
       "trace": { "stale": false, "lastImplementedPrompt": "" }
     }
   ]

*重要指示*：請務必使用繁體中文填寫所有 nodes 中的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

JSON 必須嚴格符合此 schema，缺少任何欄位都會導致匯入失敗。

我的系統功能願景是：
$goal"""
        } else {
            """Please act as a software architecture expert, analyzing my system vision described below.
I want to create a `system-graph.json` file in my project root directory. This file is our contract for co-development.
Please plan three sections and output in raw JSON format (no markdown code blocks, just raw JSON text):

1. "glossary": { "Term": "definition and data structure model description" }, extracting key business entities.
2. "globalConstraints": [ "global system constraints (e.g. tech stack, layout style)" ].
3. "nodes": [
     {
       "id": "unique-english-id (e.g., auth-helper)",
       "name": "Component Name",
       "produce": "What does this produce? starting with active verb (e.g. stores sessions locally)",
       "vibeNotes": "Supplementary developer memos for this node",
       "dependencies": [ "array of dependent node ids" ],
       "synthesis": {
         "filePath": "recommended file path (e.g., src/utils/auth.js)",
         "status": "todo",
         "intentSignal": "distilled clean core implementation goal",
         "extractedConstraints": [ "distilled technical constraints from notes (e.g., no external packages)" ],
         "userOverridden": false
       },
       "trace": { "stale": false, "lastImplementedPrompt": "" }
     }
   ]

The JSON must strictly follow this schema. Any missing fields will cause import errors.

My system vision is:
$goal"""
        }

        // Copy prompt to clipboard
        CopyPasteManager.getInstance().setContents(StringSelection(prompt))

        // Show balloon notification
        val notificationGroup = NotificationGroupManager.getInstance()
            .getNotificationGroup("VibeGraph Notifications")
        if (notificationGroup != null) {
            val message = if (isZh) {
                "✅ Bootstrap Prompt 已複製到剪貼簿！請貼到 AI 聊天視窗。"
            } else {
                "✅ Bootstrap Prompt copied! Paste it into your AI chat."
            }
            notificationGroup.createNotification(message, NotificationType.INFORMATION).notify(project)
        }
    }
}
