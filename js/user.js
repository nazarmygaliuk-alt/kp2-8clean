async function fetchRoomMembers() {
  if (!this.accessToken || !this.roomId) return;
  try {
    const res = await fetch(`https://matrix.org/_matrix/client/r0/rooms/${encodeURIComponent(this.roomId)}/joined_members`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await res.json();
    this.roomMembers = Object.entries(data.joined || {}).map(([userId, info]) => ({
      userId,
      displayName: info.display_name || userId.split(':')[0].substring(1),
    }));
  } catch (e) {
    console.error('Error fetching room members:', e);
  }
}
