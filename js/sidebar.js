async function createRoom() {
  if (!this.newRoomName.trim()) return;
  try {
    const res = await fetch('https://matrix.org/_matrix/client/r0/createRoom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ preset: 'private_chat', name: this.newRoomName.trim() })
    });
    const data = await res.json();
    if (data.room_id) {
      this.newRoomId = data.room_id;
      this.roomId = data.room_id;
      this.messages = [];
      this.lastSyncToken = '';
      await this.fetchRoomsWithNames();
      this.fetchMessages();
    } else {
      alert('Create room failed');
    }
  } catch (e) {
    console.error('Create room error:', e);
  }
}

async function fetchRoomsWithNames() {
  if (!this.accessToken) return;
  try {
    const res = await fetch('https://matrix.org/_matrix/client/r0/joined_rooms', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await res.json();
    if (data.joined_rooms) {
      const roomPromises = data.joined_rooms.map(async (roomId) => {
        const nameRes = await fetch(`https://matrix.org/_matrix/client/r0/rooms/${encodeURIComponent(roomId)}/state/m.room.name`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        const nameData = await nameRes.json();
        return { roomId, name: nameData?.name || roomId };
      });
      this.rooms = (await Promise.all(roomPromises)).sort((a, b) => a.roomId.localeCompare(b.roomId));
    }
  } catch (e) {
    console.error('Fetch rooms error:', e);
  }
}
