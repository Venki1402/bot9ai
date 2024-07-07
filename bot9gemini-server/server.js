const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const { Conversation } = require("./database");
const axios = require("axios");

dotenv.config();

class GeminiService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async createChatCompletion(messages) {
    const chat = this.model.startChat();
    let response;

    for (const message of messages) {
      response = await chat.sendMessage(message.content);
    }

    return response.response.text();
  }
}

const geminiService = new GeminiService(process.env.GEMINI_API_KEY);

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Bot9 Hotel Booking Server!" });
});

const getRoomOptions = async () => {
  try {
    const response = await axios.get("https://bot9assignement.deno.dev/rooms");
    return response.data;
  } catch (error) {
    console.error("Error fetching room options:", error);
    throw error;
  }
};

const bookRoom = async (roomId, fullName, email, nights) => {
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
    throw error;
  }
};

app.post("/chat", async (req, res) => {
  const { message, userId } = req.body;

  try {
    const conversation = await Conversation.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    const chatHistory = conversation.reverse().flatMap((c) => [
      { role: "user", content: c.message },
      { role: "model", content: c.response },
    ]);

    const systemPrompt = `You are a friendly hotel booking assistant for Bot9 Palace. Engage in casual, natural conversation. Keep responses brief and only ask for one piece of information at a time. Don't overwhelm the user with too many questions at once. Only mention room booking when the user expresses interest.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: message },
    ];

    let responseContent = await geminiService.createChatCompletion(messages);

    // Check if the user is interested in booking a room
    if (
      message.toLowerCase().includes("book") ||
      message.toLowerCase().includes("room")
    ) {
      const roomOptions = await getRoomOptions();
      responseContent = `Great! Here are our available rooms:\n\n`;
      roomOptions.forEach((room) => {
        responseContent += `Room ${room.id}: ${room.name}, ${room.description}, $${room.price}/night\n`;
      });
      responseContent += `\nWhich room interests you? Just let me know the room number.`;
    }

    // Check if the user has selected a room and provided booking details
    const bookingDetailsMatch = message.match(
      /book room (\d+),\s*name:\s*([^,]+),\s*email:\s*([^,]+),\s*nights:\s*(\d+)/i
    );
    if (bookingDetailsMatch) {
      const [, roomId, fullName, email, nights] = bookingDetailsMatch;
      try {
        const bookingResult = await bookRoom(
          parseInt(roomId),
          fullName,
          email,
          parseInt(nights)
        );
        responseContent =
          `Booking confirmed! Here's a summary:\n` +
          `Booking ID: ${bookingResult.bookingId}\n` +
          `Room: ${bookingResult.roomId}\n` +
          `Name: ${bookingResult.fullName}\n` +
          `Nights: ${bookingResult.nights}\n` +
          `Total: $${bookingResult.totalPrice}\n\n` +
          `Anything else I can help with?`;
      } catch (error) {
        responseContent =
          `Sorry, there was a problem with your booking. ${error.message}\n` +
          `Want to try a different room?`;
      }
    }

    await Conversation.create({
      userId,
      message,
      response: responseContent,
    });

    res.json({ response: responseContent });
  } catch (error) {
    console.error("Error processing chat:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
