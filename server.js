// This file is the entry point for no.de
var web = require("./lib/web/server"),

// Use the supplied app-server port
web.listen(process.env.PORT || 8001)

