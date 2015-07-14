if(window.location.hash.includes("access_token")) {
    self.port.emit("close", window.location.hash.substr(("#access_token=").length));
}
else {
    self.port.emit("abort");
}
