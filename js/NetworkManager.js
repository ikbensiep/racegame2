export default class NetworkManager {
    constructor(onOpponentUpdate) {
        this.peer = new Peer();
        this.conn = null;
        this.onOpponentUpdate = onOpponentUpdate;
        this._init();
    }

    _init() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('join');

        this.peer.on('open', (id) => {
            if (joinId) this.connect(joinId);
            else console.log("Invite link:", `${window.location.origin}${window.location.pathname}?join=${id}`);
        });

        this.peer.on('connection', (c) => this._setupConnection(c));
    }

    connect(id) {
        this._setupConnection(this.peer.connect(id));
    }

    _setupConnection(c) {
        this.conn = c;
        this.conn.on('data', (data) => this.onOpponentUpdate(data));
    }

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }
}