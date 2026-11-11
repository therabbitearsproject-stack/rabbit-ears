' Rabbit-Ears.stream on Roku.
'
' The website works out every channel's lineup; the nightly build saves it as
'   https://rabbit-ears.stream/tv/channels.json   (the channel list)
'   https://rabbit-ears.stream/tv/ch/<no>.json    (what airs on that channel, about two days ahead)
' Each item is { s: start, e: end, v: when the show's clock read 0:00, t: title, y: year, p: parts }.
' A part is [from, to, url, offset]: while (now - v) is in [from, to), play url at offset + (now - v - from).
' Shows with commercial breaks have several parts (show, bumper, ads, show...). Times are Unix seconds,
' so every Roku, phone and browser lands on the same moment of the same show.

function feedBase() as string
    return "https://rabbit-ears.stream/tv/"
end function

sub init()
    m.video = m.top.findNode("video")
    m.msg = m.top.findNode("msg")
    m.banner = m.top.findNode("banner")
    m.guide = m.top.findNode("guide")
    m.list = m.top.findNode("list")
    m.tick = m.top.findNode("tick")
    m.bannerTimer = m.top.findNode("bannerTimer")

    m.channels = []
    m.feeds = {}        ' channel number (as string) -> { items, fetched }
    m.loading = {}      ' channel numbers being downloaded
    m.cur = 0
    m.playKey = ""
    m.failedKey = ""
    m.tasks = []
    m.reg = CreateObject("roRegistrySection", "rabbitears")

    m.video.observeField("state", "onVideoState")
    m.list.observeField("itemSelected", "onGuidePick")
    m.tick.observeField("fire", "onTick")
    m.bannerTimer.observeField("fire", "hideBanner")
    m.top.setFocus(true)

    fetchJson(feedBase() + "channels.json", "channels")
end sub

function nowSec() as integer
    d = CreateObject("roDateTime")
    return d.AsSeconds()
end function

' ---------- Downloads ----------
sub fetchJson(url as string, tag as string)
    t = CreateObject("roSGNode", "FetchTask")
    t.url = url
    t.tag = tag
    t.observeField("done", "onFetched")
    t.control = "RUN"
    m.tasks.push(t)
end sub

sub onFetched(event as object)
    t = event.getRoSGNode()
    tag = t.tag
    ok = t.ok
    data = t.data
    ' Forget finished tasks.
    keep = []
    for each x in m.tasks
        if not x.isSameNode(t) then keep.push(x)
    end for
    m.tasks = keep

    if tag = "channels"
        if not ok or data.channels = invalid or data.channels.count() = 0
            m.msg.text = "Can't reach Rabbit-Ears.stream. Check your connection."
            m.top.signalBeacon("AppLaunchComplete")
            return
        end if
        m.channels = data.channels
        buildGuide()
        ' A deep link wins; otherwise pick up where the viewer left off.
        last = m.reg.Read("channel")
        if m.top.deepLink <> "" then last = m.top.deepLink
        start = 0
        for i = 0 to m.channels.count() - 1
            if StrI(m.channels[i].no).Trim() = last then start = i
        end for
        m.tick.control = "start"
        tune(start)
        ' Tells Roku the app is ready to use (required for the Channel Store).
        m.top.signalBeacon("AppLaunchComplete")
    else
        key = tag
        m.loading.Delete(key)
        if ok and data.items <> invalid and data.items.count() > 0
            m.feeds[key] = { items: data.items, fetched: nowSec() }
        end if
        if key = chKey(m.cur)
            if m.feeds.DoesExist(key) then playNow(true) else m.msg.text = "No signal on this channel right now."
        end if
    end if
end sub

' A deep link while the app is open (from Roku search or a voice command): tune to that channel.
sub onDeepLink()
    want = m.top.deepLink
    for i = 0 to m.channels.count() - 1
        if chKey(i) = want
            if m.guide.visible then closeGuide()
            tune(i)
            return
        end if
    end for
end sub

function chKey(i as integer) as string
    return StrI(m.channels[i].no).Trim()
end function

' ---------- Tuning ----------
sub tune(i as integer)
    n = m.channels.count()
    if n = 0 then return
    m.cur = (i + n) mod n
    m.playKey = ""
    m.failedKey = ""
    m.video.control = "stop"
    m.msg.text = "Tuning…"
    m.msg.visible = true
    m.reg.Write("channel", chKey(m.cur))
    m.reg.Flush()
    showBanner()
    key = chKey(m.cur)
    feed = m.feeds[key]
    if feed = invalid or stale(feed)
        if not m.loading.DoesExist(key)
            m.loading[key] = true
            fetchJson(feedBase() + "ch/" + key + ".json", key)
        end if
    else
        playNow(true)
    end if
end sub

' Refetch after six hours, or when the saved lineup is about to run out.
function stale(feed as object) as boolean
    now = nowSec()
    items = feed.items
    return now - feed.fetched > 6 * 3600 or items[items.count() - 1].e - now < 3600
end function

' What should be on screen right now: { item, part, index, pos } or invalid.
function airing() as object
    feed = m.feeds[chKey(m.cur)]
    if feed = invalid then return invalid
    now = nowSec()
    for each it in feed.items
        if it.s <= now and now < it.e
            elapsed = now - it.v
            idx = it.p.count() - 1
            for k = 0 to it.p.count() - 1
                if elapsed >= it.p[k][0] and elapsed < it.p[k][1]
                    idx = k
                    exit for
                end if
            end for
            part = it.p[idx]
            return { item: it, part: part, index: idx, pos: part[3] + (elapsed - part[0]) }
        end if
    end for
    return invalid
end function

sub playNow(force as boolean)
    a = airing()
    if a = invalid
        feed = m.feeds[chKey(m.cur)]
        if feed <> invalid and stale(feed) and not m.loading.DoesExist(chKey(m.cur))
            m.loading[chKey(m.cur)] = true
            fetchJson(feedBase() + "ch/" + chKey(m.cur) + ".json", chKey(m.cur))
        end if
        return
    end if
    key = chKey(m.cur) + "|" + StrI(a.item.s) + "|" + StrI(a.index)
    if key <> m.playKey or force
        if key = m.failedKey and not force then return
        c = CreateObject("roSGNode", "ContentNode")
        c.url = a.part[2]
        c.streamFormat = "mp4"
        c.title = a.item.t
        c.PlayStart = Int(a.pos)
        m.video.content = c
        m.video.control = "play"
        m.playKey = key
        if m.banner.visible then updateBanner()
    else if m.video.state = "playing"
        ' Stay in step with everyone else (after buffering or a hiccup).
        drift = m.video.position - a.pos
        if drift > 12 or drift < -12 then m.video.seek = a.pos
    end if
end sub

sub onTick()
    if m.channels.count() = 0 then return
    playNow(false)
    if m.banner.visible then updateBanner()
end sub

sub onVideoState()
    s = m.video.state
    if s = "playing"
        m.msg.visible = false
    else if s = "buffering"
        m.msg.text = "Tuning…"
        m.msg.visible = true
    else if s = "error"
        ' Leave it until the next show or part; the tick moves on by itself.
        m.failedKey = m.playKey
        m.msg.text = "This tape won't play. Try another channel, or wait for the next show."
        m.msg.visible = true
    end if
end sub

' ---------- Banner ----------
sub showBanner()
    updateBanner()
    m.banner.visible = true
    m.bannerTimer.control = "stop"
    m.bannerTimer.control = "start"
end sub

sub hideBanner()
    m.banner.visible = false
end sub

sub updateBanner()
    ch = m.channels[m.cur]
    m.top.findNode("bChannel").text = Right("0" + chKey(m.cur), 2) + "   " + ch.name
    a = airing()
    if a = invalid
        m.top.findNode("bTitle").text = ch.desc
        m.top.findNode("bInfo").text = ""
        return
    end if
    title = a.item.t
    if a.item.y <> invalid and a.item.y <> "" then title = title + "  (" + a.item.y + ")"
    m.top.findNode("bTitle").text = title
    mins = Int((a.item.e - nowSec()) / 60)
    info = ""
    if mins >= 1 then info = StrI(mins).Trim() + " min left" else info = "Ending now"
    nxt = nextItem(a.item)
    if nxt <> invalid then info = info + "    ·    Next: " + nxt.t
    m.top.findNode("bInfo").text = info
end sub

function nextItem(it as object) as object
    items = m.feeds[chKey(m.cur)].items
    for each x in items
        if x.s >= it.e - 1 then return x
    end for
    return invalid
end function

' ---------- Guide ----------
sub buildGuide()
    root = CreateObject("roSGNode", "ContentNode")
    for each ch in m.channels
        row = root.createChild("ContentNode")
        row.title = Right("0" + StrI(ch.no).Trim(), 2) + "   " + ch.name
    end for
    m.list.content = root
end sub

sub openGuide()
    m.banner.visible = false
    m.guide.visible = true
    m.list.jumpToItem = m.cur
    m.list.setFocus(true)
end sub

sub closeGuide()
    m.guide.visible = false
    m.top.setFocus(true)
end sub

sub onGuidePick()
    closeGuide()
    tune(m.list.itemSelected)
end sub

' ---------- Remote ----------
function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if m.guide.visible
        if key = "back" or key = "left" or key = "right" or key = "options"
            closeGuide()
            return true
        end if
        return false
    end if
    if m.channels.count() = 0 then return false
    if key = "up" or key = "channelup"
        tune(m.cur + 1)
        return true
    else if key = "down" or key = "channeldown"
        tune(m.cur - 1)
        return true
    else if key = "left" or key = "options"
        openGuide()
        return true
    else if key = "OK" or key = "info"
        if m.banner.visible then hideBanner() else showBanner()
        return true
    else if key = "back" and m.banner.visible
        hideBanner()
        return true
    end if
    return false
end function
