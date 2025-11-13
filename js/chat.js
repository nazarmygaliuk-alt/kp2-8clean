// js/chat.js

async function fetchMessages() {
  if (!this.roomId) return;
  try {
    const url = `https://matrix.org/_matrix/client/v3/rooms/${encodeURIComponent(this.roomId)}/messages?dir=b&limit=30`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    const data = await res.json();

    this.messages = (data.chunk || [])
      .filter(e => e.type === "m.room.message" && e.content?.body)
      .map(e => ({ sender: e.sender, body: e.content.body }))
      .reverse();
  } catch (e) {
    console.error("fetchMessages error:", e);
  }
}

async function sendMessage() {
  if (!this.newMessage.trim() || !this.roomId) return;
  try {
    const txnId = Date.now();
    const url = `https://matrix.org/_matrix/client/v3/rooms/${encodeURIComponent(this.roomId)}/send/m.room.message/${txnId}`;
    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ msgtype: "m.text", body: this.newMessage })
    });
    this.newMessage = "";
    await this.fetchMessages();
  } catch (e) {
    console.error("sendMessage error:", e);
  }
}
