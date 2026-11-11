sub init()
    m.top.functionName = "go"
end sub

sub go()
    t = CreateObject("roUrlTransfer")
    t.SetCertificatesFile("common:/certs/ca-bundle.crt")
    t.InitClientCertificates()
    t.EnableEncodings(true)
    t.SetUrl(m.top.url)
    body = t.GetToString()
    data = invalid
    if body <> "" then data = ParseJson(body)
    if type(data) = "roAssociativeArray"
        m.top.data = data
        m.top.ok = true
    else
        m.top.ok = false
    end if
    m.top.done = true
end sub
