package com.vibegraph

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.io.File
import java.io.FileOutputStream
import java.net.JarURLConnection
import java.net.URL

class VibeGraphToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val targetDir = File(project.basePath, ".idea/vibegraph-webview")
        try {
            extractResources("webview-assets", targetDir)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val htmlFile = File(targetDir, "index.html")
        if (!htmlFile.exists()) {
            System.err.println("VibeGraph webview assets missing!")
            return
        }

        val browser = JBCefBrowser()
        val bridge = VibeGraphJBCefBridge(project, browser)

        // Inject script on page load complete
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(cefBrowser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                if (frame?.isMain == true) {
                    bridge.registerQueryHandler()
                }
            }
        }, browser.cefBrowser)

        val fileWatcher = VibeGraphFileWatcher(project, bridge)
        fileWatcher.startWatching()

        val contentFactory = ContentFactory.getInstance()
        val content = contentFactory.createContent(browser.component, "", false)
        
        content.setDisposer {
            fileWatcher.stopWatching()
        }

        toolWindow.contentManager.addContent(content)

        // Load page
        browser.loadURL("file:///" + htmlFile.absolutePath.replace("\\", "/"))
    }

    private fun extractResources(resourcePath: String, targetDirectory: File) {
        val resource: URL = javaClass.classLoader.getResource(resourcePath) ?: return
        val connection = resource.openConnection()
        if (connection is JarURLConnection) {
            val jarFile = connection.jarFile
            val entries = jarFile.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (entry.name.startsWith(resourcePath) && !entry.isDirectory) {
                    var relativePath = entry.name.substring(resourcePath.length)
                    if (relativePath.startsWith("/")) {
                        relativePath = relativePath.substring(1)
                    }
                    val targetFile = File(targetDirectory, relativePath)
                    targetFile.parentFile.mkdirs()
                    jarFile.getInputStream(entry).use { input ->
                        FileOutputStream(targetFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                }
            }
        } else {
            // Development mode where resource points to build directory
            val file = File(resource.toURI())
            if (file.isDirectory) {
                copyDirectory(file, targetDirectory)
            }
        }
    }

    private fun copyDirectory(source: File, target: File) {
        if (source.isDirectory) {
            if (!target.exists()) {
                target.mkdirs()
            }
            val children = source.list() ?: return
            for (child in children) {
                copyDirectory(File(source, child), File(target, child))
            }
        } else {
            source.inputStream().use { input ->
                target.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }
    }
}
