plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services") apply false
}

if (file("google-services.json").isFile) {
    apply(plugin = "com.google.gms.google-services")
}

val releaseKeystoreFile = System.getenv("ANDROID_KEYSTORE_FILE")
val releaseKeystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ANDROID_KEY_PASSWORD")
val hasReleaseSigning = listOf(releaseKeystoreFile, releaseKeystorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() } && file(releaseKeystoreFile ?: "").exists()

// Stagepulse production line; CI supplies the custom next version and monotonic code.
val stagepulseVersionName = (project.findProperty("stagepulse.versionName") as String?)?.trim()?.ifBlank { null } ?: "2.3.0"
val stagepulseVersionParts = stagepulseVersionName.split(".")
require(stagepulseVersionParts.size == 3 && stagepulseVersionParts.all { it.toIntOrNull() != null }) { "Stagepulse versionName must be MAJOR.MINOR.PATCH" }
val stagepulseMajor = stagepulseVersionParts[0].toInt()
val stagepulseMinor = stagepulseVersionParts[1].toInt()
val stagepulsePatch = stagepulseVersionParts[2].toInt()
require(stagepulseMajor >= 2 && stagepulseMinor >= 0 && stagepulsePatch >= 0) { "Stagepulse production release must be 2.0.0 or newer." }
val semanticVersionCode = stagepulseMajor * 1_000_000 + stagepulseMinor * 1_000 + stagepulsePatch
val stagepulseVersionCode = (project.findProperty("stagepulse.versionCode") as String?)?.trim()?.toIntOrNull() ?: semanticVersionCode
require(stagepulseVersionCode >= 2_000_000) { "Stagepulse production versionCode must be 2.0.0 or newer." }

android {
    namespace = "tr.com.stagepulse.app"
    compileSdk = 36
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    defaultConfig {
        applicationId = "tr.com.stagepulse.app"
        minSdk = 23
        targetSdk = 36
        versionCode = stagepulseVersionCode
        versionName = stagepulseVersionName
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6\"")
    }
    signingConfigs {
        if (hasReleaseSigning) create("release") {
            storeFile = file(releaseKeystoreFile!!); storePassword = releaseKeystorePassword; keyAlias = releaseKeyAlias; keyPassword = releaseKeyPassword
        }
    }
    flavorDimensions += "portal"
    productFlavors {
        create("personel") { dimension = "portal"; applicationId = "tr.com.stagepulse.app"; resValue("string", "app_name", "Stagepulse"); buildConfigField("String", "PORTAL_PATH", "\"/portal/\""); buildConfigField("String", "APP_VARIANT", "\"staff\"") }
        create("admin") { dimension = "portal"; applicationId = "tr.com.stagepulse.admin"; resValue("string", "app_name", "Stagepulse Admin"); buildConfigField("String", "PORTAL_PATH", "\"/admin/\""); buildConfigField("String", "APP_VARIANT", "\"admin\"") }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }
}

tasks.configureEach {
    if ((name.startsWith("assemble") || name.startsWith("bundle")) && name.contains("Release")) {
        doFirst {
            check(hasReleaseSigning) {
                "Release signing is mandatory. Configure the repository signing secrets."
            }
        }
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.17.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    testImplementation("junit:junit:4.13.2")
}
