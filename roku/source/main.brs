' Rabbit-Ears.stream for Roku. The app is one SceneGraph scene (components/MainScene).
' Deep links: launching (or sending input) with contentId=<channel number> opens that channel,
' e.g. curl -d "" "http://<roku>:8060/launch/dev?contentId=97&mediaType=live".
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    if type(args) = "roAssociativeArray" and args.contentId <> invalid then scene.deepLink = args.contentId
    input = CreateObject("roInput")
    input.setMessagePort(port)
    while true
        msg = wait(0, port)
        t = type(msg)
        if t = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        else if t = "roInputEvent"
            info = msg.getInfo()
            if info <> invalid and info.contentId <> invalid then scene.deepLink = info.contentId
        end if
    end while
end sub
