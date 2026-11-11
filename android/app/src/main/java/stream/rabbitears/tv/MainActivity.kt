package stream.rabbitears.tv

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlin.math.abs

/**
 * Rabbit-Ears.stream for Android TV, Google TV and Fire TV (and phones).
 *
 * The website works out every channel's lineup; each publish saves it as
 *   https://rabbit-ears.stream/tv/channels.json   (the channel list)
 *   https://rabbit-ears.stream/tv/ch/<no>.json    (what airs on that channel, about two days ahead)
 * Each item is { s: start, e: end, v: when the show's clock read 0:00, t: title, y: year, p: parts }.
 * A part is [from, to, url, offset]: while (now - v) is in [from, to), play url at offset + (now - v - from).
 * Times are Unix seconds, so every TV, phone and browser lands on the same moment of the same show.
 * Same logic as the Roku app (roku/components/MainScene.brs).
 */
class MainActivity : Activity() {
    private val base = "https://rabbit-ears.stream/tv/"

    private data class Channel(val no: Int, val name: String, val desc: String)
    private data class Part(val from: Double, val to: Double, val url: String, val offset: Double)
    private data class Item(val s: Long, val e: Long, val v: Long, val title: String, val year: String, val parts: List<Part>)
    private data class Feed(val items: List<Item>, val fetched: Long)
    private data class Airing(val item: Item, val part: Part, val index: Int, val pos: Double)

    private lateinit var player: ExoPlayer
    private lateinit var msg: TextView
    private lateinit var banner: LinearLayout
    private lateinit var guide: LinearLayout
    private lateinit var list: ListView

    private var channels = listOf<Channel>()
    private val feeds = mutableMapOf<Int, Feed>()
    private val loading = mutableSetOf<Int>()
    private var cur = 0
    private var playKey = ""
    private var failedKey = ""

    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("rabbitears", Context.MODE_PRIVATE) }
    private val tick = object : Runnable {
        override fun run() {
            if (channels.isNotEmpty()) {
                playNow(false)
                if (banner.visibility == View.VISIBLE) updateBanner()
            }
            main.postDelayed(this, 2000)
        }
    }
    private val hideBannerLater = Runnable { banner.visibility = View.GONE }

    private fun now() = System.currentTimeMillis() / 1000

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        msg = findViewById(R.id.msg)
        banner = findViewById(R.id.banner)
        guide = findViewById(R.id.guide)
        list = findViewById(R.id.list)
        findViewById<TextView>(R.id.bHint).text =
            if (isTv()) "Up / Down: change channel   ·   Left: channel guide   ·   OK: what's on"
            else "Swipe up / down: change channel   ·   Tap: channel guide"

        player = ExoPlayer.Builder(this).build()
        findViewById<PlayerView>(R.id.player).player = player
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> msg.visibility = View.GONE
                    Player.STATE_BUFFERING -> showMsg("Tuning…")
                    else -> {}
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                // Leave it until the next show or part; the tick moves on by itself.
                failedKey = playKey
                showMsg("This tape won't play. Try another channel, or wait for the next show.")
            }
        })

        list.setOnItemClickListener { _, _, position, _ -> closeGuide(); tune(position) }
        setupTouch()

        fetchJson(base + "channels.json") { data ->
            val arr = data?.optJSONArray("channels")
            if (arr == null || arr.length() == 0) {
                showMsg("Can't reach Rabbit-Ears.stream. Check your connection.")
                return@fetchJson
            }
            channels = (0 until arr.length()).map { i ->
                val c = arr.getJSONObject(i)
                Channel(c.getInt("no"), c.getString("name"), c.optString("desc"))
            }
            list.adapter = ArrayAdapter(this, R.layout.guide_row,
                channels.map { "%02d   %s".format(it.no, it.name) })
            val last = prefs.getInt("channel", -1)
            tune(channels.indexOfFirst { it.no == last }.coerceAtLeast(0))
        }
    }

    override fun onStart() {
        super.onStart()
        main.post(tick)
        if (channels.isNotEmpty()) playNow(true)
    }

    override fun onStop() {
        super.onStop()
        main.removeCallbacks(tick)
        player.stop()
        playKey = ""
    }

    override fun onDestroy() {
        super.onDestroy()
        player.release()
        io.shutdown()
    }

    private fun isTv() = packageManager.hasSystemFeature("android.software.leanback")

    private fun showMsg(text: String) {
        msg.text = text
        msg.visibility = View.VISIBLE
    }

    // ---------- Downloads ----------
    private fun fetchJson(url: String, done: (JSONObject?) -> Unit) {
        io.execute {
            val data = try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 30000
                conn.inputStream.bufferedReader().use { JSONObject(it.readText()) }
            } catch (e: Exception) { null }
            main.post { done(data) }
        }
    }

    private fun parseFeed(data: JSONObject): Feed? {
        val arr = data.optJSONArray("items") ?: return null
        val items = (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val p = o.getJSONArray("p")
            Item(o.getLong("s"), o.getLong("e"), o.getLong("v"), o.optString("t"), o.optString("y"),
                (0 until p.length()).map { k ->
                    val a = p.getJSONArray(k)
                    Part(a.getDouble(0), a.getDouble(1), a.getString(2), a.getDouble(3))
                })
        }
        return if (items.isEmpty()) null else Feed(items, now())
    }

    private fun loadFeed(no: Int) {
        if (!loading.add(no)) return
        fetchJson(base + "ch/$no.json") { data ->
            loading.remove(no)
            data?.let { parseFeed(it) }?.let { feeds[no] = it }
            if (channels.getOrNull(cur)?.no == no) {
                if (feeds[no] != null) playNow(true) else showMsg("No signal on this channel right now.")
            }
        }
    }

    // ---------- Tuning ----------
    private fun tune(i: Int) {
        if (channels.isEmpty()) return
        cur = ((i % channels.size) + channels.size) % channels.size
        playKey = ""
        failedKey = ""
        player.stop()
        showMsg("Tuning…")
        val no = channels[cur].no
        prefs.edit().putInt("channel", no).apply()
        showBanner()
        val feed = feeds[no]
        if (feed == null || stale(feed)) loadFeed(no) else playNow(true)
    }

    /** Refetch after six hours, or when the saved lineup is about to run out. */
    private fun stale(feed: Feed) = now() - feed.fetched > 6 * 3600 || feed.items.last().e - now() < 3600

    private fun airing(): Airing? {
        val no = channels.getOrNull(cur)?.no ?: return null
        val feed = feeds[no] ?: return null
        val t = now()
        val item = feed.items.firstOrNull { it.s <= t && t < it.e } ?: return null
        val elapsed = (t - item.v).toDouble()
        var idx = item.parts.indexOfFirst { elapsed >= it.from && elapsed < it.to }
        if (idx < 0) idx = item.parts.size - 1
        val part = item.parts[idx]
        return Airing(item, part, idx, part.offset + (elapsed - part.from))
    }

    private fun playNow(force: Boolean) {
        val no = channels.getOrNull(cur)?.no ?: return
        val a = airing()
        if (a == null) {
            val feed = feeds[no]
            if (feed != null && stale(feed)) loadFeed(no)
            return
        }
        val key = "$no|${a.item.s}|${a.index}"
        if (key != playKey || force) {
            if (key == failedKey && !force) return
            player.setMediaItem(MediaItem.fromUri(a.part.url), (a.pos * 1000).toLong())
            player.prepare()
            player.play()
            playKey = key
            if (banner.visibility == View.VISIBLE) updateBanner()
        } else if (player.isPlaying) {
            // Stay in step with everyone else (after buffering or a hiccup).
            val drift = player.currentPosition / 1000.0 - a.pos
            if (abs(drift) > 12) player.seekTo((a.pos * 1000).toLong())
        }
    }

    // ---------- Banner ----------
    private fun showBanner() {
        updateBanner()
        banner.visibility = View.VISIBLE
        main.removeCallbacks(hideBannerLater)
        main.postDelayed(hideBannerLater, 6000)
    }

    private fun updateBanner() {
        val ch = channels.getOrNull(cur) ?: return
        findViewById<TextView>(R.id.bChannel).text = "%02d   %s".format(ch.no, ch.name)
        val a = airing()
        val title = findViewById<TextView>(R.id.bTitle)
        val info = findViewById<TextView>(R.id.bInfo)
        if (a == null) {
            title.text = ch.desc
            info.text = ""
            return
        }
        title.text = if (a.item.year.isNotEmpty()) "${a.item.title}  (${a.item.year})" else a.item.title
        val mins = (a.item.e - now()) / 60
        val next = feeds[ch.no]?.items?.firstOrNull { it.s >= a.item.e - 1 }
        info.text = (if (mins >= 1) "$mins min left" else "Ending now") + (next?.let { "    ·    Next: ${it.title}" } ?: "")
    }

    // ---------- Guide ----------
    private fun openGuide() {
        banner.visibility = View.GONE
        guide.visibility = View.VISIBLE
        list.setItemChecked(cur, true)
        list.setSelection(cur)
        list.requestFocus()
    }

    private fun closeGuide() {
        guide.visibility = View.GONE
    }

    // ---------- Remote ----------
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (guide.visibility == View.VISIBLE) {
            if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                keyCode == KeyEvent.KEYCODE_DPAD_RIGHT || keyCode == KeyEvent.KEYCODE_MENU) {
                closeGuide()
                return true
            }
            return super.onKeyDown(keyCode, event)
        }
        if (channels.isEmpty()) return super.onKeyDown(keyCode, event)
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP -> { tune(cur + 1); return true }
            KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN -> { tune(cur - 1); return true }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_GUIDE -> { openGuide(); return true }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_INFO -> {
                if (banner.visibility == View.VISIBLE) banner.visibility = View.GONE else showBanner()
                return true
            }
            KeyEvent.KEYCODE_BACK -> if (banner.visibility == View.VISIBLE) { banner.visibility = View.GONE; return true }
        }
        return super.onKeyDown(keyCode, event)
    }

    // ---------- Touch (phones and tablets) ----------
    private fun setupTouch() {
        var downY = 0f
        findViewById<View>(R.id.root).setOnTouchListener { v, e ->
            when (e.action) {
                MotionEvent.ACTION_DOWN -> downY = e.y
                MotionEvent.ACTION_UP -> {
                    val dy = e.y - downY
                    when {
                        guide.visibility == View.VISIBLE -> closeGuide()
                        dy < -120 -> tune(cur + 1)
                        dy > 120 -> tune(cur - 1)
                        else -> { v.performClick(); if (channels.isNotEmpty()) openGuide() }
                    }
                }
            }
            true
        }
    }
}
