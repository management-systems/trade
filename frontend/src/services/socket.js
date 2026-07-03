class WebSocketManager {
  constructor() {
    // Use env variable; fall back to auto-detecting wss vs ws based on current page protocol
    const envWs = import.meta.env.VITE_WS_URL;
    const autoWs = window.location.protocol === 'https:'
      ? `wss://${window.location.host}`
      : `ws://localhost:5072`;
    this.url = envWs || autoWs;
    this.ws = null;
    this.listeners = {};
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws) {
      this.close();
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log("WebSocket: Connected to backend stream.");
        this.trigger('connect');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.trigger('message', payload);
        } catch (e) {
          console.error("WebSocket: Message parsing error:", e);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket: Connection error:", error);
        this.trigger('error', error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log("WebSocket: Connection closed. Attempting reconnect in 3s...");
        this.trigger('disconnect');
        
        // Clear any duplicate timer
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 3000);
      };
    } catch (error) {
      console.error("WebSocket: Connection initialization failed:", error);
    }
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  trigger(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`WebSocket: Error in listener for event "${event}":`, e);
      }
    });
  }
}

export const socket = new WebSocketManager();
