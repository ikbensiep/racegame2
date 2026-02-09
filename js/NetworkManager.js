export default class NetworkManager {
    constructor(game, onOpponentUpdate) {

      this.game = game;
      this.peer = new Peer(undefined, {
        config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        // Forceert de browser om sneller op te geven bij slechte verbindingen
        'iceCandidatePoolSize': 10
        },
        debug: 2
      });
      
      this.conn = null;
      this.onOpponentUpdate = onOpponentUpdate;
      console.warn(game)
      this._init();
    }

    _init() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('join');

        this.peer.on('open', (id) => {
            if (joinId) {
              // we joined an invite
              this.connect(joinId);
            } else { 
              // we can invite other players
              console.log("📨 Invite link:", `${window.location.origin}${window.location.pathname}?join=${id}`);
            }
        });

        this.peer.on('connection', (c) => this._setupConnection(c));
    }

    connect(id) {
        this._setupConnection(this.peer.connect(id));
    }

    _setupConnection(c) {
      this.conn = c;
      c.on('data', (data) => { 
        if (data.id === this.peer.id) return; 
          this.onOpponentUpdate(data)
      });

      c.on('open', () => {
        console.log("🤝 Handshakey! 🔌 Connected to:", c.peer);
        
        const pakketje = { 
            type: 'hello',
            id: this.peer.id,
            name: this.game.localPlayer.name || 'Anonymous Racer', // Zorg dat dit ergens staat
            color: this.game.localPlayer.color || 'blue'
        };
        
        // Stuur direct je 'paspoort' naar de nieuwe peer
        c.send(pakketje);
    });
    }

    send(data) {
        if (this.conn && this.conn.open) this.conn.send(data);
    }
}