plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "tr.com.stagepulse.licenseadmin"
    compileSdk = 36
    defaultConfig {
        applicationId = "tr.com.stagepulse.licenseadmin"
        minSdk = 23
        targetSdk = 35
        versionCode = 10000
        versionName = "1.0.0"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
