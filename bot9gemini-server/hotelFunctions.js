const axios = require("axios");

async function getRoomOptions() {
  try {
    const response = await axios.get("https://bot9assignement.deno.dev/rooms");
    return response.data;
  } catch (error) {
    console.error("Error fetching room options:", error);
    return [];
  }
}

async function bookRoom(roomId, fullName, email, nights) {
  try {
    const response = await axios.post("https://bot9assignement.deno.dev/book", {
      roomId,
      fullName,
      email,
      nights,
    });
    return response.data;
  } catch (error) {
    console.error("Error booking room:", error);
    return null;
  }
}

module.exports = {
  getRoomOptions,
  bookRoom,
};
