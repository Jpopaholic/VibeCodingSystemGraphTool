package com.vibegraph

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.Consumer
import java.awt.Component
import java.awt.event.MouseEvent

class VibeGraphStatusBarWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = "VibeGraphStatusBarWidget"
    override fun getDisplayName(): String = "VibeGraph Status Bar Button"
    override fun isAvailable(project: Project): Boolean = true
    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        return object : StatusBarWidget, StatusBarWidget.TextPresentation {
            override fun ID(): String = "VibeGraphStatusBarWidget"
            override fun getPresentation(): StatusBarWidget.WidgetPresentation? = this
            override fun install(statusBar: StatusBar) {}
            override fun dispose() {}

            // TextPresentation properties
            override fun getText(): String = "📊 VibeGraph"
            override fun getTooltipText(): String = "Open VibeGraph Map Dashboard"
            override fun getAlignment(): Float = Component.RIGHT_ALIGNMENT

            override fun getClickConsumer(): Consumer<MouseEvent> {
                return Consumer { e ->
                    val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("VibeGraph")
                    if (toolWindow != null) {
                        if (toolWindow.isVisible) {
                            toolWindow.hide(null)
                        } else {
                            toolWindow.show(null)
                        }
                    }
                }
            }
        }
    }

    override fun disposeWidget(widget: StatusBarWidget) {
        widget.dispose()
    }
}
