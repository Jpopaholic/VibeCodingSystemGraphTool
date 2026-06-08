package com.vibegraph

import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import java.io.File
import java.util.Locale

class VibeGraphJBCefBridge(private val project: Project, private val browser: JBCefBrowser) {
    private val gson = GsonBuilder().setPrettyPrinting().create()
    private val query = JBCefJSQuery.create(browser)

    init {
        query.addHandler { request ->
            try {
                val jsonRequest = JsonParser.parseString(request).asJsonObject
                val command = jsonRequest.get("command").asString
                handleCommand(command, jsonRequest)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            null
        }
    }

    fun injectQueryBridge() {
        // Inject window.cefQuery to handle frontend postMessages
        val injectScript = """
            window.cefQuery = function(payload) {
                ${query.inject("payload.request", "payload.onSuccess", "payload.onFailure")}
            };
            // Dispatches init events or custom notifications when JCEF browser triggers load
            console.log("VibeGraph JCEF Query Bridge Injected.");
        """.trimIndent()

        browser.cefBrowser.executeJavaScript(
            injectScript,
            browser.cefBrowser.url, 0
        )
    }

    private fun handleCommand(command: String, request: JsonObject) {
        val projectRoot = project.basePath ?: return
        val graphPath = File(projectRoot, "system-graph.json")

        when (command) {
            "ready" -> {
                ApplicationManager.getApplication().executeOnPooledThread {
                    var graphData: JsonObject? = null
                    if (graphPath.exists()) {
                        try {
                            val content = graphPath.readText()
                            graphData = JsonParser.parseString(content).asJsonObject
                        } catch (e: Exception) {
                            System.err.println("Error parsing system-graph.json: ${e.message}")
                        }
                    }

                    // Sync node statuses based on physical file presence
                    var graphChanged = false
                    if (graphData != null && graphData.has("nodes") && graphData.get("nodes").isJsonArray) {
                        val nodes = graphData.getAsJsonArray("nodes")
                        for (nodeElement in nodes) {
                            if (nodeElement.isJsonObject) {
                                val node = nodeElement.asJsonObject
                                if (node.has("synthesis") && node.get("synthesis").isJsonObject) {
                                    val synthesis = node.getAsJsonObject("synthesis")
                                    if (synthesis.has("filePath")) {
                                        val relPath = synthesis.get("filePath").asString
                                        if (relPath.isNotEmpty()) {
                                            val fullFile = File(projectRoot, relPath)
                                            val fileExists = fullFile.exists() && fullFile.isFile
                                            val expectedStatus = if (fileExists) "completed" else "todo"
                                            val currentStatus = if (synthesis.has("status")) synthesis.get("status").asString else "todo"
                                            if (currentStatus != expectedStatus) {
                                                synthesis.addProperty("status", expectedStatus)
                                                graphChanged = true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (graphChanged && graphData != null) {
                        try {
                            graphPath.writeText(gson.toJson(graphData))
                            // Refresh VFS so the IDE sees the updated system-graph.json
                            LocalFileSystem.getInstance().refreshAndFindFileByIoFile(graphPath)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    val graphStr = if (graphData != null) gson.toJson(graphData) else "null"
                    val lang = Locale.getDefault().language
                    postMessageToWebview(
                        """{
                            "type": "init",
                            "workspaceRoot": "${projectRoot.replace("\\", "/")}",
                            "graph": $graphStr,
                            "language": "$lang"
                        }"""
                    )
                }
            }

            "saveGraph" -> {
                ApplicationManager.getApplication().executeOnPooledThread {
                    try {
                        val graphData = request.getAsJsonObject("data")
                        graphPath.writeText(gson.toJson(graphData))
                        LocalFileSystem.getInstance().refreshAndFindFileByIoFile(graphPath)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            "readFiles" -> {
                val filesArray = request.getAsJsonArray("files")
                val fileContents = JsonObject()
                val requestId = request.get("requestId").asString

                ApplicationManager.getApplication().executeOnPooledThread {
                    for (fileElement in filesArray) {
                        val relPath = fileElement.asString
                        val fullFile = File(projectRoot, relPath)
                        if (fullFile.exists() && fullFile.isFile) {
                            try {
                                fileContents.addProperty(relPath, fullFile.readText())
                            } catch (e: Exception) {
                                fileContents.addProperty(relPath, "// Error reading file: ${e.message}")
                            }
                        } else {
                            fileContents.addProperty(relPath, "// File does not exist yet at path: $relPath")
                        }
                    }

                    postMessageToWebview(
                        """{
                            "type": "filesRead",
                            "requestId": "$requestId",
                            "files": $fileContents
                        }"""
                    )
                }
            }

            "writeFile" -> {
                val relPath = request.get("filePath").asString
                val codeContent = request.get("codeContent").asString
                val requestId = request.get("requestId").asString
                val targetFile = File(projectRoot, relPath)

                ApplicationManager.getApplication().executeOnPooledThread {
                    var success = false
                    var errorMsg = ""
                    try {
                        targetFile.parentFile.mkdirs()
                        targetFile.writeText(codeContent)
                        LocalFileSystem.getInstance().refreshAndFindFileByIoFile(targetFile)
                        success = true
                    } catch (e: Exception) {
                        errorMsg = e.message ?: "Write file failed"
                    }

                    val response = JsonObject()
                    response.addProperty("type", "fileWritten")
                    response.addProperty("requestId", requestId)
                    response.addProperty("success", success)
                    if (success) {
                        response.addProperty("filePath", relPath)
                    } else {
                        response.addProperty("error", errorMsg)
                    }

                    postMessageToWebview(response.toString())
                }
            }

            "openFile" -> {
                val relPath = request.get("filePath").asString
                val fullFile = File(projectRoot, relPath)
                if (fullFile.exists() && fullFile.isFile) {
                    ApplicationManager.getApplication().invokeLater {
                        val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(fullFile)
                        if (virtualFile != null) {
                            FileEditorManager.getInstance(project).openFile(virtualFile, true)
                        }
                    }
                } else {
                    val isZh = Locale.getDefault().language.startsWith("zh")
                    val message = if (isZh) {
                        "VibeGraph: 檔案尚不存在：$relPath"
                    } else {
                        "VibeGraph: File does not exist yet: $relPath"
                    }
                    val notificationGroup = com.intellij.notification.NotificationGroupManager.getInstance()
                        .getNotificationGroup("VibeGraph Notifications")
                    notificationGroup?.createNotification(message, com.intellij.notification.NotificationType.WARNING)
                        ?.notify(project)
                }
            }
        }
    }

    fun postMessageToWebview(jsonMessage: String) {
        val script = "if (window.onHostMessage) { window.onHostMessage($jsonMessage); } else { window.postMessage($jsonMessage, '*'); }"
        browser.cefBrowser.executeJavaScript(script, browser.cefBrowser.url, 0)
    }
}
