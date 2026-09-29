package com.arvydas.fivethreeone

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * HealthConnect (SPEC.md §12). Writes one ExerciseSessionRecord per finished session with one
 * ExerciseSegment per logged set, and reads heart rate, resting heart rate, HRV, sleep and weight.
 *
 * Not yet compiled on a machine with the Android SDK; the first Gradle build is the check.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO)

    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    private fun permissionFor(key: String): String? = when (key) {
        "writeExercise" -> HealthPermission.getWritePermission(ExerciseSessionRecord::class)
        "writeHeartRate" -> HealthPermission.getWritePermission(HeartRateRecord::class)
        "readHeartRate" -> HealthPermission.getReadPermission(HeartRateRecord::class)
        "readRestingHeartRate" -> HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        "readHrv" -> HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class)
        "readSleep" -> HealthPermission.getReadPermission(SleepSessionRecord::class)
        "readWeight" -> HealthPermission.getReadPermission(WeightRecord::class)
        else -> null
    }

    private fun keyFor(permission: String): String? =
        listOf("writeExercise", "readHeartRate", "readRestingHeartRate", "readHrv", "readSleep", "readWeight")
            .firstOrNull { permissionFor(it) == permission }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val ret = JSObject()
        ret.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        ret.put("status", when (status) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "updateRequired"
            else -> "unavailable"
        })
        call.resolve(ret)
    }

    @PluginMethod
    fun getGranted(call: PluginCall) {
        scope.launch {
            try {
                val granted = client().permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("granted", JSArray(granted.mapNotNull { keyFor(it) })))
            } catch (e: Throwable) {
                call.reject("getGranted: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Named to avoid clashing with Plugin.requestPermissions from the Capacitor base class. */
    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        val keys = call.getArray("types")?.toList<String>() ?: emptyList()
        val perms = keys.mapNotNull { permissionFor(it) }.toSet()
        if (perms.isEmpty()) {
            call.reject("no known permission types")
            return
        }
        val contract = PermissionController.createRequestPermissionResultContract()
        val intent = contract.createIntent(context, perms)
        startActivityForResult(call, intent, "onPermissionResult")
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val contract = PermissionController.createRequestPermissionResultContract()
        val granted = contract.parseResult(result.resultCode, result.data)
        call.resolve(JSObject().put("granted", JSArray(granted.mapNotNull { keyFor(it) })))
    }

    private fun segmentType(key: String): Int = when (key) {
        "squat" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_SQUAT
        "benchPress" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BENCH_PRESS
        "deadlift" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DEADLIFT
        "barbellShoulderPress" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BARBELL_SHOULDER_PRESS
        "pullUp" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_PULL_UP
        "lunge" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LUNGE
        "dumbbellRow" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DUMBBELL_ROW
        "plank" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_PLANK
        "sitUp" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_SIT_UP
        "armCurl" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_ARM_CURL
        "backExtension" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_BACK_EXTENSION
        "dumbbellTricepsExtensionTwoArm" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DUMBBELL_TRICEPS_EXTENSION_TWO_ARM
        "frontRaise" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_FRONT_RAISE
        "dumbbellLateralRaise" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_DUMBBELL_LATERAL_RAISE
        "legCurl" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_CURL
        "legRaise" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_LEG_RAISE
        "walking" -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_WALKING
        else -> ExerciseSegment.EXERCISE_SEGMENT_TYPE_WEIGHTLIFTING
    }

    @PluginMethod
    fun writeSession(call: PluginCall) {
        // Everything before the coroutine runs on the bridge thread, where an uncaught exception kills the process.
        val clientId: String
        val start: Instant
        val end: Instant
        val title: String?
        val notes: String?
        val zone: ZoneOffset
        val segments = mutableListOf<ExerciseSegment>()
        try {
            clientId = call.getString("clientId") ?: return call.reject("clientId required")
            start = Instant.ofEpochMilli(call.getLong("startMs") ?: return call.reject("startMs required"))
            end = Instant.ofEpochMilli(call.getLong("endMs") ?: return call.reject("endMs required"))
            title = call.getString("title")
            notes = call.getString("notes")
            zone = ZoneId.systemDefault().rules.getOffset(start)
            // Nested objects in a JSArray are plain org.json.JSONObject, not JSObject; a generic toList() cast throws.
            val arr = call.getArray("segments")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val s = arr.getJSONObject(i)
                    val sStart = Instant.ofEpochMilli(s.getLong("startMs"))
                    val sEnd = Instant.ofEpochMilli(s.getLong("endMs"))
                    if (!sEnd.isAfter(sStart)) continue
                    segments.add(ExerciseSegment(sStart, sEnd, segmentType(s.optString("type", "weightlifting")), s.optInt("reps", 0)))
                }
            }
        } catch (e: Throwable) {
            return call.reject("writeSession arguments: ${e.message ?: e.javaClass.simpleName}")
        }
        scope.launch {
            try {
                val c = client()
                // upsert by client record id: delete any previous record for this session first
                c.deleteRecords(ExerciseSessionRecord::class, recordIdsList = emptyList(), clientRecordIdsList = listOf(clientId))
                val record = ExerciseSessionRecord(
                    startTime = start,
                    startZoneOffset = zone,
                    endTime = end,
                    endZoneOffset = zone,
                    exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                    title = title,
                    notes = notes,
                    metadata = Metadata.activelyRecorded(Device(type = Device.TYPE_PHONE), clientRecordId = clientId),
                    segments = segments.sortedBy { it.startTime },
                )
                c.insertRecords(listOf(record))
                call.resolve()
            } catch (e: Throwable) {
                call.reject("writeSession: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun deleteSession(call: PluginCall) {
        val clientId = call.getString("clientId") ?: return call.reject("clientId required")
        scope.launch {
            try {
                client().deleteRecords(ExerciseSessionRecord::class, recordIdsList = emptyList(), clientRecordIdsList = listOf(clientId))
                call.resolve()
            } catch (e: Throwable) {
                call.reject("deleteSession: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun writeHeartRate(call: PluginCall) {
        val start: Instant
        val end: Instant
        val zone: ZoneOffset
        val samples = mutableListOf<HeartRateRecord.Sample>()
        try {
            start = Instant.ofEpochMilli(call.getLong("startMs") ?: return call.reject("startMs required"))
            end = Instant.ofEpochMilli(call.getLong("endMs") ?: return call.reject("endMs required"))
            zone = ZoneId.systemDefault().rules.getOffset(start)
            val arr = call.getArray("samples")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val s = arr.getJSONObject(i)
                    val t = Instant.ofEpochMilli(s.getLong("ts"))
                    val bpm = s.getLong("bpm")
                    if (t.isBefore(start) || t.isAfter(end) || bpm <= 0) continue
                    samples.add(HeartRateRecord.Sample(t, bpm))
                }
            }
        } catch (e: Throwable) {
            return call.reject("writeHeartRate arguments: ${e.message ?: e.javaClass.simpleName}")
        }
        if (samples.isEmpty()) return call.resolve()
        scope.launch {
            try {
                val c = client()
                // Only this app's own records in the window can be deleted this way; other sources are never touched.
                c.deleteRecords(HeartRateRecord::class, TimeRangeFilter.between(start, end))
                val sorted = samples.sortedBy { it.time }
                for (chunk in sorted.chunked(1000)) {
                    c.insertRecords(listOf(HeartRateRecord(chunk.first().time, zone, chunk.last().time, zone, chunk, Metadata.activelyRecorded(Device(type = Device.TYPE_PHONE)))))
                }
                call.resolve()
            } catch (e: Throwable) {
                call.reject("writeHeartRate: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun deleteHeartRate(call: PluginCall) {
        val start = Instant.ofEpochMilli(call.getLong("startMs") ?: return call.reject("startMs required"))
        val end = Instant.ofEpochMilli(call.getLong("endMs") ?: return call.reject("endMs required"))
        scope.launch {
            try {
                client().deleteRecords(HeartRateRecord::class, TimeRangeFilter.between(start, end))
                call.resolve()
            } catch (e: Throwable) {
                call.reject("deleteHeartRate: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @PluginMethod
    fun readHeartRate(call: PluginCall) {
        val start = Instant.ofEpochMilli(call.getLong("startMs") ?: return call.reject("startMs required"))
        val end = Instant.ofEpochMilli(call.getLong("endMs") ?: return call.reject("endMs required"))
        scope.launch {
            try {
                val res = client().readRecords(ReadRecordsRequest(HeartRateRecord::class, TimeRangeFilter.between(start, end)))
                val arr = JSArray()
                res.records.forEach { r ->
                    val origin = r.metadata.dataOrigin.packageName
                    r.samples.forEach { s ->
                        arr.put(JSObject().put("ts", s.time.toEpochMilli()).put("bpm", s.beatsPerMinute).put("source", origin))
                    }
                }
                call.resolve(JSObject().put("samples", arr))
            } catch (e: Throwable) {
                call.reject("readHeartRate: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    /** Readiness values for a window (previous evening to session start). */
    @PluginMethod
    fun readDaily(call: PluginCall) {
        val start = Instant.ofEpochMilli(call.getLong("startMs") ?: return call.reject("startMs required"))
        val end = Instant.ofEpochMilli(call.getLong("endMs") ?: return call.reject("endMs required"))
        scope.launch {
            try {
                val c = client()
                val range = TimeRangeFilter.between(start, end)
                val ret = JSObject()
                runCatching {
                    c.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, range)).records.lastOrNull()
                }.getOrNull()?.let { ret.put("restingHr", it.beatsPerMinute) }
                runCatching {
                    c.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, range)).records.lastOrNull()
                }.getOrNull()?.let { ret.put("hrvRmssd", it.heartRateVariabilityMillis) }
                runCatching {
                    c.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records.lastOrNull()
                }.getOrNull()?.let { s ->
                    ret.put("sleepMinutes", (s.endTime.toEpochMilli() - s.startTime.toEpochMilli()) / 60000)
                    val stages = JSObject()
                    s.stages.groupBy { it.stage }.forEach { (stage, list) ->
                        stages.put(stage.toString(), list.sumOf { (it.endTime.toEpochMilli() - it.startTime.toEpochMilli()) / 60000 })
                    }
                    ret.put("sleepStages", stages)
                }
                runCatching {
                    c.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records.lastOrNull()
                }.getOrNull()?.let { ret.put("weightKg", it.weight.inKilograms) }
                call.resolve(ret)
            } catch (e: Throwable) {
                call.reject("readDaily: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }
}
