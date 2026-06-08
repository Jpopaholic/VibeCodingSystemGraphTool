package com.vibegraph

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.newvfs.events.VFileCreateEvent
import com.intellij.openapi.vfs.newvfs.events.VFileDeleteEvent
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent
import com.intellij.util.messages.MessageBusConnection
import java.io.File

class VibeGraphFileWatcher(private val project: Project, private val bridge: VibeGraphJBCefBridge) {
    private var connection: MessageBusConnection? = null

    fun startWatching() {
        if (connection != null) return
        val projectRoot = project.basePath ?: return

        connection = project.messageBus.connect()
        connection?.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
            override fun after(events: List<VFileEvent>) {
                val graphPath = File(projectRoot, "system-graph.json").absolutePath.replace("\\", "/")
                
                for (event in events) {
                    val eventPath = event.path.replace("\\", "/")
                    if (!eventPath.startsWith(projectRoot)) continue

                    // If system-graph.json changed, reload the graph
                    if (eventPath == graphPath) {
                        try {
                            val file = File(graphPath)
                            if (file.exists() && file.isFile) {
                                val content = file.readText()
                                bridge.postMessageToWebview(
                                    """{
                                        "type": "graphFileChanged",
                                        "graph": $content
                                    }"""
                                )
                            }
                        } catch (e: Exception) {
                            bridge.postMessageToWebview(
                                """{
                                    "type": "graphFileError",
                                    "error": "${e.message}"
                                }"""
                            )
                        }
                        continue
                    }

                    // Map VFS event to simple strings
                    val eventType = when (event) {
                        is VFileCreateEvent -> "create"
                        is VFileDeleteEvent -> "delete"
                        is VFileContentChangeEvent -> "change"
                        else -> "change"
                    }

                    val relativePath = eventPath.substring(projectRoot.length).trimStart('/')
                    bridge.postMessageToWebview(
                        """{
                            "type": "fileSystemEvent",
                            "event": "$eventType",
                            "filePath": "$relativePath"
                        }"""
                    )
                }
            }
        })
    }

    fun stopWatching() {
        connection?.disconnect()
        connection = null
    }
}
