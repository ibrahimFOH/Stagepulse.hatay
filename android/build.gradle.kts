import org.gradle.api.Task
import org.gradle.api.execution.TaskExecutionListener
import org.gradle.api.tasks.TaskState

plugins {
    id("com.android.application") version "8.10.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.21" apply false
    id("com.google.gms.google-services") version "4.5.0" apply false
}

if (System.getenv("GITHUB_ACTIONS") == "true") {
    gradle.taskGraph.addTaskExecutionListener(object : TaskExecutionListener {
        override fun beforeExecute(task: Task) = Unit

        override fun afterExecute(task: Task, state: TaskState) {
            val failure = state.failure ?: return
            val details = generateSequence(failure as Throwable?) { it.cause }
                .mapNotNull { it.message?.trim()?.takeIf(String::isNotEmpty) }
                .distinct()
                .joinToString(" | ")
                .ifBlank { "Gradle task failed without an exception message." }
                .replace("%", "%25")
                .replace("\r", "%0D")
                .replace("\n", "%0A")
            println("::error title=Gradle task ${task.path} failed::$details")
        }
    })
}
