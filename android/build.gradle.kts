import org.gradle.api.Task
import org.gradle.api.execution.TaskExecutionListener
import org.gradle.api.logging.StandardOutputListener
import org.gradle.api.tasks.TaskState
import java.util.concurrent.ConcurrentHashMap

plugins {
    id("com.android.application") version "8.10.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.21" apply false
    id("com.google.gms.google-services") version "4.5.0" apply false
}

if (System.getenv("GITHUB_ACTIONS") == "true") {
    val kotlinCompilerOutput = ConcurrentHashMap<String, StringBuilder>()
    gradle.taskGraph.addTaskExecutionListener(object : TaskExecutionListener {
        override fun beforeExecute(task: Task) {
            if (task.name.startsWith("compile") && task.name.endsWith("Kotlin")) {
                val output = StringBuilder()
                kotlinCompilerOutput[task.path] = output
                task.logging.addStandardOutputListener(StandardOutputListener { output.append(it) })
                task.logging.addStandardErrorListener(StandardOutputListener { output.append(it) })
            }
        }

        override fun afterExecute(task: Task, state: TaskState) {
            val failure = state.failure ?: return
            val causes = generateSequence(failure as Throwable?) { it.cause }
                .mapNotNull { it.message?.trim()?.takeIf(String::isNotEmpty) }
                .distinct()
                .joinToString(" | ")
            val compilerLines = kotlinCompilerOutput.remove(task.path)
                ?.lineSequence()
                ?.map(String::trim)
                ?.filter { it.startsWith("e:") || it.contains(".kt:") || it.contains("error:", ignoreCase = true) }
                ?.toList()
                ?.takeLast(30)
                ?.joinToString(" | ")
                .orEmpty()
            val details = listOf(causes, compilerLines)
                .filter(String::isNotBlank)
                .joinToString(" | ")
                .ifBlank { "Gradle task failed without an exception message." }
                .replace("%", "%25")
                .replace("\r", "%0D")
                .replace("\n", "%0A")
            println("::error title=Gradle task ${task.path} failed::$details")
        }
    })
}
