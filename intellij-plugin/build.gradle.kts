plugins {
    java
    kotlin("jvm") version "1.9.22"
    id("org.jetbrains.intellij") version "1.17.4"
}

group = "com.vibegraph"
version = "1.0.1"
repositories {
    mavenCentral()
}

dependencies {
    implementation(platform("org.jetbrains.kotlin:kotlin-bom"))
    implementation("org.jetbrains.kotlin:kotlin-stdlib")
}

// Configure IntelliJ Platform Gradle Plugin
intellij {
    version.set("2023.2.6") // Target 2023.2 as base to ensure maximum Android Studio compatibility
    type.set("IC")         // IntelliJ Community
    plugins.set(listOf("java"))
}

// Task to copy the built webview assets into the resources folder
val copyWebview = tasks.register<Copy>("copyWebview") {
    from(file("../webview/dist"))
    into(file("src/main/resources/webview-assets"))
}

// Hook into the processResources task so webview assets are bundled automatically
tasks.processResources {
    dependsOn(copyWebview)
}

tasks.patchPluginXml {
    sinceBuild.set("232")
    untilBuild.set("262.*") // Support versions up to 2026.2
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions.jvmTarget = "17"
}

tasks.withType<JavaCompile> {
    sourceCompatibility = "17"
    targetCompatibility = "17"
}

tasks.buildSearchableOptions {
    enabled = false
}


