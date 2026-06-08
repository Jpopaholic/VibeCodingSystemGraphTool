package com.vibegraph

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ide.BrowserUtil
import javax.swing.*
import java.awt.BorderLayout
import java.awt.FlowLayout
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

        // Check if JCEF is supported in the current IDE environment
        if (!JBCefApp.isSupported()) {
            val panel = JPanel(BorderLayout())
            panel.border = BorderFactory.createEmptyBorder(20, 20, 20, 20)

            val textLabel = JLabel("<html><body style='width: 300px; text-align: center;'>" +
                    "<h2>VibeGraph 需要 JCEF 支援</h2>" +
                    "<p style='margin-top: 10px;'>當前 IDE 執行環境不支援 JCEF (JetBrains Chromium Embedded Framework)。</p>" +
                    "<p style='margin-top: 5px; color: gray;'>請確保 IDE 使用搭載 JBR (JetBrains Runtime) 的 SDK 啟動。</p>" +
                    "</body></html>")
            textLabel.horizontalAlignment = SwingConstants.CENTER
            panel.add(textLabel, BorderLayout.CENTER)

            val buttonPanel = JPanel(FlowLayout(FlowLayout.CENTER))
            val browseButton = JButton("在外部瀏覽器中開啟地圖 🌐")
            browseButton.addActionListener {
                if (htmlFile.exists()) {
                    BrowserUtil.browse(htmlFile.toURI())
                } else {
                    JOptionPane.showMessageDialog(panel, "找不到 Webview 靜態資源，請確認插件是否安裝完整。")
                }
            }
            buttonPanel.add(browseButton)
            panel.add(buttonPanel, BorderLayout.SOUTH)

            val contentFactory = ContentFactory.getInstance()
            val content = contentFactory.createContent(panel, "", false)
            toolWindow.contentManager.addContent(content)
            return
        }

        val browser = JBCefBrowser()
        // Force the creation of the underlying browser UI component to avoid IllegalStateException on JBCefJSQuery
        browser.component
        
        val bridge = VibeGraphJBCefBridge(project, browser)

        // Inject script on page load complete
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(cefBrowser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                if (frame?.isMain == true) {
                    bridge.injectQueryBridge()
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
        val path = htmlFile.absolutePath.replace("\\", "/")
        val isWindows = java.io.File.separatorChar == '\\'
        val url = (if (isWindows) "file:///$path" else "file://$path") + "?ide=intellij"
        browser.loadURL(url)
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
