function chatApp() {
  return {
    // === СТАН ДОДАТКУ ===
    username: "",
    password: "",
    accessToken: localStorage.getItem("matrix_token") || "",
    userId: "",
    rooms: [],
    invitedRooms: [],
    roomMembers: [],
    messages: [],
    currentRoom: null,

    // === ДОДАТКОВІ ЗМІННІ ===
    newRoomName: "",
    newMessage: "",
    inviteUserId: "",
    joinRoomId: "",
    error: "",

    // === ІНІЦІАЛІЗАЦІЯ ===
    async init() {
      console.log("🚀 App initialized");
      if (this.accessToken) {
        await this.getProfile();
        await this.loadRooms();
        await this.loadInvites();
      }
    },

    // === ЛОГІН ===
    async login() {
      if (!this.username || !this.password) {
        alert("Введіть логін та пароль");
        return;
      }

      try {
        const res = await fetch("https://matrix.org/_matrix/client/v3/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "m.login.password",
            user: this.username,
            password: this.password,
          }),
        });

        const data = await res.json();
        if (data.access_token) {
          this.accessToken = data.access_token;
          this.userId = data.user_id;
          localStorage.setItem("matrix_token", data.access_token);
          console.log("✅ Logged in:", data.user_id);
          await this.loadRooms();
          await this.loadInvites();
        } else {
          alert("❌ Помилка входу: перевірте дані");
        }
      } catch (err) {
        console.error("Login error:", err);
        alert("Помилка під час логіну");
      }
    },

    // === ВИХІД ===
    logout() {
      localStorage.removeItem("matrix_token");
      this.accessToken = "";
      this.rooms = [];
      this.messages = [];
      this.userId = "";
      this.currentRoom = null;
    },

    // === ПРОФІЛЬ ===
    async getProfile() {
      try {
        const res = await fetch("https://matrix.org/_matrix/client/v3/account/whoami", {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        const data = await res.json();
        this.userId = data.user_id;
      } catch (err) {
        console.error("Не вдалося отримати профіль:", err);
      }
    },

    // === ЗАВАНТАЖЕННЯ КІМНАТ (з назвами) ===
async loadRooms() {
  try {
    const res = await fetch("https://matrix.org/_matrix/client/v3/joined_rooms", {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = await res.json();

    // Тимчасово створюємо масив ID
    const roomIds = data.joined_rooms || [];

    // Отримуємо назви кімнат асинхронно
    const roomsData = await Promise.all(
      roomIds.map(async (id) => {
        try {
          // Запитуємо назву кімнати
          const roomRes = await fetch(
            `https://matrix.org/_matrix/client/v3/rooms/${id}/state/m.room.name`,
            { headers: { Authorization: `Bearer ${this.accessToken}` } }
          );

          if (roomRes.ok) {
            const roomInfo = await roomRes.json();
            return { room_id: id, name: roomInfo.name || id };
          } else {
            // Якщо назви немає, використовуємо ID
            return { room_id: id, name: id };
          }
        } catch {
          return { room_id: id, name: id };
        }
      })
    );

    this.rooms = roomsData;
    console.log("📦 Rooms with names:", this.rooms);
  } catch (err) {
    console.error("Помилка при завантаженні кімнат:", err);
  }
},


    // === СТВОРЕННЯ КІМНАТИ ===
    async createRoom() {
      if (!this.newRoomName) return;
      try {
        const res = await fetch("https://matrix.org/_matrix/client/v3/createRoom", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: this.newRoomName, preset: "private_chat" }),
        });
        const data = await res.json();
        console.log("✅ Room created:", data.room_id);
        this.newRoomName = "";
        await this.loadRooms();
      } catch (err) {
        console.error("Помилка при створенні кімнати:", err);
      }
    },

    // === ВИБІР КІМНАТИ ===
    async selectRoom(room) {
      this.currentRoom = room;
      this.messages = [];
      await this.loadMessages();
      await this.getRoomMembers();
    },

    // === ЗАВАНТАЖЕННЯ ПОВІДОМЛЕНЬ ===
    async loadMessages() {
      if (!this.currentRoom) return;
      try {
        const res = await fetch(
          `https://matrix.org/_matrix/client/v3/rooms/${this.currentRoom.room_id}/messages?dir=b&limit=30`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const data = await res.json();
        this.messages = (data.chunk || [])
          .filter((m) => m.type === "m.room.message")
          .map((m) => ({
            sender: m.sender,
            body: m.content.body,
            event_id: m.event_id,
          }))
          .reverse();
      } catch (err) {
        console.error("Помилка при завантаженні повідомлень:", err);
      }
    },

    // === ВІДПРАВКА ПОВІДОМЛЕННЯ ===
    async sendMessage() {
      if (!this.newMessage || !this.currentRoom) return;
      try {
        const txnId = Date.now();
        await fetch(
          `https://matrix.org/_matrix/client/v3/rooms/${this.currentRoom.room_id}/send/m.room.message/${txnId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ msgtype: "m.text", body: this.newMessage }),
          }
        );
        this.messages.push({ sender: this.userId, body: this.newMessage, event_id: txnId });
        this.newMessage = "";
      } catch (err) {
        console.error("Помилка при відправці повідомлення:", err);
      }
    },

    // === ІНВАЙТИ ===
    async loadInvites() {
      try {
        const res = await fetch("https://matrix.org/_matrix/client/v3/sync", {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        const data = await res.json();
        if (data.rooms?.invite) {
          this.invitedRooms = Object.keys(data.rooms.invite).map((roomId) => ({
            room_id: roomId,
            name: data.rooms.invite[roomId].invite_state.events[0]?.content?.name || roomId,
          }));
        }
      } catch (err) {
        console.error("Помилка при отриманні інвайтів:", err);
      }
    },

    async acceptInvite(roomId) {
      try {
        const res = await fetch(`https://matrix.org/_matrix/client/v3/rooms/${roomId}/join`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (res.ok) {
          console.log("✅ Joined room:", roomId);
          await this.loadRooms();
          await this.loadInvites();
        }
      } catch (err) {
        console.error("Помилка при прийнятті інвайту:", err);
      }
    },

    async inviteUser() {
      if (!this.inviteUserId || !this.currentRoom) {
        alert("Виберіть кімнату та введіть користувача!");
        return;
      }
      try {
        const res = await fetch(
          `https://matrix.org/_matrix/client/v3/rooms/${this.currentRoom.room_id}/invite`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: this.inviteUserId }),
          }
        );
        if (res.ok) {
          alert(`✅ ${this.inviteUserId} запрошено`);
          this.inviteUserId = "";
        } else {
          alert("❌ Помилка інвайту");
        }
      } catch (err) {
        console.error("Invite error:", err);
      }
    },

    // === ПРИЄДНАННЯ ДО КІМНАТИ ЗА ID ===
    async joinRoom() {
      if (!this.joinRoomId) return;
      try {
        const res = await fetch(
          `https://matrix.org/_matrix/client/v3/join/${encodeURIComponent(this.joinRoomId)}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${this.accessToken}` },
          }
        );
        if (res.ok) {
          console.log("✅ Joined room:", this.joinRoomId);
          this.joinRoomId = "";
          await this.loadRooms();
        } else {
          alert("❌ Не вдалося приєднатись");
        }
      } catch (err) {
        console.error("Join room error:", err);
      }
    },

    // === УЧАСНИКИ КІМНАТИ ===
    async getRoomMembers() {
      if (!this.currentRoom) return;
      try {
        const res = await fetch(
          `https://matrix.org/_matrix/client/v3/rooms/${this.currentRoom.room_id}/members`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const data = await res.json();
        this.roomMembers = (data.chunk || []).map((m) => ({
          user_id: m.state_key,
          displayname: m.content.displayname,
        }));
      } catch (err) {
        console.error("Помилка при отриманні учасників:", err);
      }
    },

    // === КОПІЮВАННЯ ROOM ID ===
    copyRoomId() {
      if (this.currentRoom?.room_id) {
        navigator.clipboard.writeText(this.currentRoom.room_id);
        alert("Room ID скопійовано");
      }
    },
  };
}

window.chatApp = chatApp;
